import type { EmailEvent, EmailId, SendEmailOptions } from "@convex-dev/resend";
import { NAVET_LOGO_URL } from "@workspace/emails/constants";
import { DEGREES, HUGIN_LOCAL_URL } from "@workspace/shared/constants";
import { featureFlags } from "@workspace/shared/feature-flags";
import { reportHighlights } from "@workspace/shared/feedback/report";
import { feedbackReportCsv } from "@workspace/shared/feedback/report-csv";
import { toBase64 } from "@workspace/shared/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertFeedbackResponses } from "../../../test/feedbackResponses";
import {
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertSemester,
	insertStudent,
	insertUser,
	setup,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import { hashLinkToken } from "../../lib/tokens";
import { defaultFeedbackFields } from "../defaultFields";
import { feedbackResend } from "../delivery/messages";

const reports = api.feedback.reports;
const jobs = internal.feedback.reports;
const now = Date.UTC(2026, 8, 23, 10);
const token = "a".repeat(43);
const paginationOpts = { cursor: null, numItems: 100 };
async function fixture(count = 2) {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "admin@example.test");
	await grantRole(t, user._id, "super-admin");
	const client = asUser(t, user);
	const formId = await client.mutation(api.feedback.forms.mutations.saveDraft, {
		name: "Feedback",
		fields: defaultFeedbackFields,
	});
	const formVersionId = await client.mutation(api.feedback.forms.mutations.publish, { formId });
	const eventId = await insertEvent(t, companyId);
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			formVersionId,
			status: "closed",
			opensAt: now - 14 * 86400000,
			closesAt: now,
			closedAt: now,
			retentionAt: now + 86400000,
			generation: 1,
		}),
	);
	await t.run(async (ctx) => {
		await insertFeedbackResponses(ctx, {
			campaignId,
			formVersionId,
			userId: user._id,
			count: count,
			submittedAt: now - 1,
		});
	});
	async function prepare() {
		const reportId = await client.mutation(reports.build.prepare, { campaignId });
		let cursor: string | null = null;
		for (;;) {
			await t.mutation(jobs.build.buildReportBatch, { reportId, cursor });
			const report = await t.run((ctx) => ctx.db.get(reportId));
			if (report?.status !== "building") break;
			cursor = report.buildCursor;
		}
		return reportId;
	}
	return { t, client, user, eventId, campaignId, companyId, formId, formVersionId, prepare };
}
async function queued(f: Awaited<ReturnType<typeof fixture>>) {
	const reportId = await f.prepare();
	await f.client.mutation(reports.mutations.approve, {
		reportId,
		revision: 0,
		recipientEmail: "contact@example.test",
	});
	await f.t.mutation(jobs.messages.enqueue, {
		reportId,
		token,
		url: `${HUGIN_LOCAL_URL}/report#token=${token}`,
		html: "report",
	});
	return reportId;
}
const resendApiKey = feedbackResend.config.apiKey;
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	featureFlags.huginFeedback.reportsEnabled = true;
	featureFlags.huginFeedback.reportEmailsEnabled = true;
	vi.stubEnv("APP_ENV", "local");
	vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	Object.assign(featureFlags.huginFeedback, {
		reportsEnabled: false,
		reportEmailsEnabled: false,
	});
	feedbackResend.config.apiKey = resendApiKey;
});

describe("company feedback reports", () => {
	it("snapshots the dashboard's degree, program and year statistics without exposing participants", async () => {
		const f = await fixture();
		const program = "Informatikk: programmering og systemarkitektur";
		const studentId = await insertStudent(f.t, f.user._id, { studyProgram: program, year: 2 });
		await insertRegistration(f.t, f.eventId, f.user._id, "registered");
		const second = await insertUser(f.t, "second@example.test");
		await insertStudent(f.t, second._id, { studyProgram: program, year: 2 });
		await insertRegistration(f.t, f.eventId, second._id, "registered");
		const third = await insertUser(f.t, "third@example.test");
		await insertStudent(f.t, third._id, {
			studyProgram: "Design",
			year: 1,
			degree: DEGREES.aarsstudium,
		});
		await insertRegistration(f.t, f.eventId, third._id, "registered");
		const unknown = await insertUser(f.t, "unknown@example.test");
		await insertRegistration(f.t, f.eventId, unknown._id, "registered");
		const waiting = await insertUser(f.t, "waiting@example.test");
		await insertRegistration(f.t, f.eventId, waiting._id, "waitlist");
		const dashboard = await f.client.query(api.events.registrations.queries.getRegistrantsInfo, {
			eventIdentifier: f.eventId,
		});
		expect(dashboard).toEqual({
			bachelor: { [toBase64(program)]: { "2": 2 } },
			aarsstudium: { [toBase64("Design")]: { "1": 1 } },
			Ukjent: { [toBase64("Ukjent")]: { "-1": 1 } },
		});
		const reportId = await queued(f);
		await f.t.run((ctx) => ctx.db.patch(studentId, { year: 3 }));
		const preview = await f.client.query(reports.queries.getEventReport, { eventId: f.eventId });
		expect(preview?.enabled && preview.report?.registrants).toEqual(dashboard);
		const page = await f.t.action(reports.public.resolveReport, { token, paginationOpts });
		expect(page?.report.registrants).toEqual(dashboard);
		expect(JSON.stringify(page)).not.toContain(f.user._id);
		expect(JSON.stringify(page)).not.toContain("second@example.test");
		expect(feedbackReportCsv(page!.report, page!.answers)).toContain(
			`Grad: Bachelor;${program}, år 2;2`,
		);
		expect(feedbackReportCsv(page!.report, page!.answers)).toContain(
			`Grad: ${DEGREES.aarsstudium};Design, år 1;1`,
		);
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({ registrants: dashboard });
	});

	it("materializes all pages once with individual text entries and exact default questions", async () => {
		const f = await fixture(28);
		const reportId = await f.prepare();
		expect(await f.client.mutation(reports.build.prepare, { campaignId: f.campaignId })).toBe(
			reportId,
		);
		await f.t.mutation(jobs.build.buildReportBatch, { reportId, cursor: null });
		const result = await f.client.query(reports.queries.getEventReport, { eventId: f.eventId });
		expect(result?.enabled && result.report).toMatchObject({
			status: "draft",
			totalResponses: 28,
			recipientEmail: "",
		});
		if (!result?.enabled || !result.report) throw new Error("Missing report");
		expect(result.report.questions.map((q) => q.label)).toEqual(
			defaultFeedbackFields.map((q) => q.label),
		);
		expect(reportHighlights(result.report)).toEqual({ rating: 4, employment: 0.5 });
		const answers = await f.client.query(reports.queries.getReportAnswers, {
			reportId,
			paginationOpts,
		});
		expect(answers.page).toHaveLength(84);
		expect(answers.page[0]).not.toHaveProperty("responseId");
		await f.client.mutation(api.feedback.forms.mutations.saveDraft, {
			formId: f.formId,
			name: "Changed",
			fields: [defaultFeedbackFields[0]],
		});
		expect(await f.client.query(reports.queries.getEventReport, { eventId: f.eventId })).toEqual(
			result,
		);
	});
	it("hides individual text answers and locks the exact preview and recipient on approval", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		const answers = await f.client.query(reports.queries.getReportAnswers, {
			reportId,
			paginationOpts,
		});
		const hidden = answers.page[0];
		await f.client.mutation(reports.mutations.setAnswerVisibility, {
			reportId,
			revision: 0,
			answerId: hidden.id,
			visible: false,
		});
		await expect(
			f.client.mutation(reports.mutations.approve, {
				reportId,
				revision: 0,
				recipientEmail: "contact@example.test",
			}),
		).rejects.toThrow("endret");
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 1,
			recipientEmail: "contact@example.test",
		});
		await expect(
			f.client.mutation(reports.mutations.setAnswerVisibility, {
				reportId,
				revision: 2,
				answerId: hidden.id,
				visible: true,
			}),
		).rejects.toThrow("godkjent");
		await f.t.mutation(jobs.messages.enqueue, { reportId, token, url: "link", html: "report" });
		await f.t.mutation(jobs.messages.enqueue, {
			reportId,
			token: "b".repeat(43),
			url: "different",
			html: "different",
		});
		const page = await f.t.action(reports.public.resolveReport, { token, paginationOpts });
		expect(page?.answers).toHaveLength(5);
		expect(page?.answers.some((answer) => answer.id === hidden.id)).toBe(false);
		expect(page?.report).not.toHaveProperty("recipientEmail");
		expect(page?.report).not.toHaveProperty("approvedBy");
		expect(page?.report).not.toHaveProperty("campaignId");
		if (!page) throw new Error("Missing public report");
		expect(feedbackReportCsv(page.report, page.answers)).not.toContain(hidden.text);
		expect(
			await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect()),
		).toHaveLength(1);
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			tokenHash: await hashLinkToken(token),
			revision: 2,
		});
	});
	it("keeps public links independent of flags and denies revoked, expired, malformed and unknown links", async () => {
		const f = await fixture();
		const reportId = await queued(f);
		featureFlags.huginFeedback.reportsEnabled = false;
		featureFlags.huginFeedback.reportEmailsEnabled = false;
		expect(
			await f.t.action(reports.public.resolveReport, { token, paginationOpts }),
		).not.toBeNull();
		for (const invalid of ["", "short", "b".repeat(43)])
			expect(
				await f.t.action(reports.public.resolveReport, { token: invalid, paginationOpts }),
			).toBeNull();
		vi.setSystemTime(now + 86400000);
		expect(await f.t.action(reports.public.resolveReport, { token, paginationOpts })).toBeNull();
		vi.setSystemTime(now);
		featureFlags.huginFeedback.reportsEnabled = true;
		await f.client.mutation(reports.mutations.revoke, { reportId, revision: 1 });
		expect(await f.t.action(reports.public.resolveReport, { token, paginationOpts })).toBeNull();
	});
	it("requires assigned internal organizers or super admins, with flags off by default", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		await expect(
			f.t.query(reports.queries.getEventReport, { eventId: f.eventId }),
		).rejects.toThrow();
		const organizer = await insertUser(f.t, "organizer@example.test");
		const client = asUser(f.t, organizer);
		await insertOrganizer(f.t, f.eventId, organizer._id);
		expect(await client.query(reports.queries.getEventReport, { eventId: f.eventId })).toEqual({
			enabled: false,
		});
		await expect(
			client.query(reports.queries.getReportAnswers, { reportId, paginationOpts }),
		).rejects.toThrow("arrangør");
		await grantRole(f.t, organizer._id, "internal");
		expect(
			await client.query(reports.queries.getEventReport, { eventId: f.eventId }),
		).toMatchObject({ enabled: true, campaignId: f.campaignId });
		const otherEvent = await insertEvent(f.t, f.companyId);
		expect(await client.query(reports.queries.getEventReport, { eventId: otherEvent })).toEqual({
			enabled: false,
		});
		featureFlags.huginFeedback.reportsEnabled = false;
		expect(await client.query(reports.queries.getEventReport, { eventId: f.eventId })).toEqual({
			enabled: false,
		});
		await expect(
			client.query(reports.queries.getReportAnswers, { reportId, paginationOpts }),
		).rejects.toThrow("slått av");
		await expect(
			client.mutation(reports.build.prepare, { campaignId: f.campaignId }),
		).rejects.toThrow("slått av");
	});
	it("refuses premature, retained and expired campaigns, empty reports, and invalid recipients", async () => {
		const f = await fixture(0);
		for (const status of ["open", "scheduled", "cancelled"] as const) {
			await f.t.run((ctx) => ctx.db.patch(f.campaignId, { status }));
			await expect(f.prepare()).rejects.toThrow("avsluttet");
		}
		await f.t.run((ctx) => ctx.db.patch(f.campaignId, { status: "closed", retainedAt: now }));
		await expect(f.prepare()).rejects.toThrow("avsluttet");
		await f.t.run((ctx) => ctx.db.patch(f.campaignId, { retainedAt: undefined, retentionAt: now }));
		await expect(f.prepare()).rejects.toThrow("utløpt");
		await f.t.run((ctx) => ctx.db.patch(f.campaignId, { retentionAt: now + 86400000 }));
		const reportId = await f.prepare();
		await expect(
			f.client.mutation(reports.mutations.approve, {
				reportId,
				revision: 0,
				recipientEmail: "contact@example.test",
			}),
		).rejects.toThrow("ingen svar");
		const another = await fixture();
		const anotherId = await another.prepare();
		await expect(
			another.client.mutation(reports.mutations.approve, {
				reportId: anotherId,
				revision: 0,
				recipientEmail: "bad",
			}),
		).rejects.toThrow("gyldig");
	});
	it("rechecks email flags after approval and retries the same locked snapshot", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		featureFlags.huginFeedback.reportEmailsEnabled = false;
		await expect(
			f.client.mutation(reports.mutations.approve, {
				reportId,
				revision: 0,
				recipientEmail: "contact@example.test",
			}),
		).rejects.toThrow("slått av");
		featureFlags.huginFeedback.reportEmailsEnabled = true;
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 0,
			recipientEmail: "contact@example.test",
		});
		featureFlags.huginFeedback.reportEmailsEnabled = false;
		await f.t.mutation(jobs.messages.enqueue, { reportId, token, url: "link", html: "report" });
		expect(await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect())).toEqual([]);
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			status: "approved",
			deliveryStatus: "failed",
		});
		await expect(
			f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 1 }),
		).rejects.toThrow("slått av");
		featureFlags.huginFeedback.reportEmailsEnabled = true;
		await f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 1 });
		await f.t.action(jobs.mail.sendReportEmail, { reportId });
		const captures = await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect());
		expect(captures).toHaveLength(1);
		expect(captures[0].to).toBe("contact@example.test");
		expect(captures[0].html).toContain("Se rapporten");
		expect(captures[0].html).not.toContain(".webp");
		expect(captures[0].html).toContain("mailto:arrangement@ifinavet.no");
		expect(captures[0].html.split(NAVET_LOGO_URL)).toHaveLength(2);
		const generatedToken = new URLSearchParams(new URL(captures[0].url).hash.slice(1)).get("token");
		expect(generatedToken).toHaveLength(43);
		await f.t.action(jobs.mail.sendReportEmail, { reportId });
		expect(
			await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect()),
		).toHaveLength(1);
	});
	it("expires access at the exact retention boundary and removes text and captures in batches", async () => {
		const f = await fixture(40);
		const reportId = await queued(f);
		await f.t.mutation(jobs.build.expireReport, { reportId });
		expect(await f.t.run((ctx) => ctx.db.query("feedbackReportAnswers").collect())).toHaveLength(
			120,
		);
		vi.setSystemTime(now + 86400000 - 1);
		expect(
			(await f.client.query(reports.queries.getReportAnswers, { reportId, paginationOpts })).page,
		).not.toHaveLength(0);
		vi.setSystemTime(now + 86400000);
		await expect(
			f.client.query(reports.queries.getReportAnswers, { reportId, paginationOpts }),
		).rejects.toThrow("Lagringstiden");
		await f.t.mutation(jobs.build.expireReport, { reportId });
		await expect(
			f.client.query(reports.queries.getReportAnswers, { reportId, paginationOpts }),
		).rejects.toThrow("Lagringstiden");
		await f.t.mutation(jobs.build.expireReport, { reportId });
		expect(await f.t.run((ctx) => ctx.db.query("feedbackReportAnswers").collect())).toHaveLength(0);
		expect(
			await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect()),
		).toHaveLength(0);
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			status: "revoked",
			recipientEmail: "",
		});
	});
});

describe("report boundary cases", () => {
	it("prefills the event contact and tolerates a missing logo and legacy retention dates", async () => {
		const f = await fixture();
		const semesterId = await insertSemester(f.t);
		await insertApplication(f.t, semesterId, { eventId: f.eventId });
		await f.t.run(async (ctx) => {
			const company = await ctx.db.get(f.companyId);
			if (company) await ctx.db.delete(company.logo);
			await ctx.db.patch(f.campaignId, { retentionAt: undefined, closedAt: undefined });
		});
		const reportId = await f.prepare();
		const result = await f.client.query(reports.queries.getEventReport, { eventId: f.eventId });
		expect(result?.enabled && result.report).toMatchObject({
			recipientEmail: "ingrid@fjordkode.no",
			companyLogoUrl: null,
		});
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 0,
			recipientEmail: "ingrid@fjordkode.no",
		});
		await f.t.mutation(jobs.messages.enqueue, { reportId, token, url: "link", html: "report" });
		expect(
			(await f.t.action(reports.public.resolveReport, { token, paginationOpts }))?.report
				.companyLogoUrl,
		).toBeNull();
	});
	it("handles missing records and invalid pinned fields without creating partial reports", async () => {
		for (const missing of ["campaign", "version", "event", "company", "fields"] as const) {
			const f = await fixture();
			await f.t.run(async (ctx) => {
				if (missing === "campaign") await ctx.db.delete(f.campaignId);
				if (missing === "version") await ctx.db.patch(f.campaignId, { formVersionId: undefined });
				if (missing === "event") await ctx.db.delete(f.eventId);
				if (missing === "company") await ctx.db.delete(f.companyId);
				if (missing === "fields") {
					const fields = await ctx.db.query("formFields").collect();
					for (const field of fields) await ctx.db.delete(field._id);
				}
			});
			await expect(f.prepare()).rejects.toThrow();
			expect(await f.t.run((ctx) => ctx.db.query("feedbackReports").collect())).toEqual([]);
		}
	});
	it("starts building only when enabled and ignores stale or expired batch jobs", async () => {
		const f = await fixture();
		featureFlags.huginFeedback.reportsEnabled = false;
		await f.t.mutation(jobs.build.prepareClosedReport, { campaignId: f.campaignId });
		expect(await f.client.query(reports.queries.getEventReport, { eventId: f.eventId })).toEqual({
			enabled: false,
		});
		featureFlags.huginFeedback.reportsEnabled = true;
		expect(
			await f.client.query(reports.queries.getEventReport, { eventId: f.eventId }),
		).toMatchObject({ report: null });
		await f.t.mutation(jobs.build.prepareClosedReport, { campaignId: f.campaignId });
		const report = await f.t.run((ctx) => ctx.db.query("feedbackReports").first());
		if (!report) throw new Error("Missing report");
		await f.t.mutation(jobs.build.buildReportBatch, { reportId: report._id, cursor: "stale" });
		expect(await f.t.run((ctx) => ctx.db.get(report._id))).toMatchObject({
			totalResponses: 0,
			status: "building",
		});
		vi.setSystemTime(report.retentionAt);
		await f.t.mutation(jobs.build.buildReportBatch, { reportId: report._id, cursor: null });
		expect(await f.t.run((ctx) => ctx.db.get(report._id))).toMatchObject({ totalResponses: 0 });
		await f.t.run((ctx) => ctx.db.delete(report._id));
		await f.t.mutation(jobs.build.buildReportBatch, { reportId: report._id, cursor: null });
		await f.t.mutation(jobs.build.expireReport, { reportId: report._id });
		await f.t.mutation(jobs.messages.failed, { reportId: report._id });
		await f.t.mutation(jobs.messages.enqueue, { reportId: report._id, token, url: "", html: "" });
		expect(await f.t.query(jobs.messages.getDelivery, { reportId: report._id })).toBeNull();
		await expect(
			f.client.query(reports.queries.getReportAnswers, { reportId: report._id, paginationOpts }),
		).rejects.toThrow("finnes ikke");
		await expect(
			f.client.mutation(reports.mutations.revoke, { reportId: report._id, revision: 0 }),
		).rejects.toThrow("finnes ikke");
		await f.t.run((ctx) => ctx.db.delete(f.campaignId));
		expect(await f.client.query(reports.queries.getEventReport, { eventId: f.eventId })).toBeNull();
	});
	it("enforces revision, state, expiry and answer ownership on every mutation", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		const answers = await f.client.query(reports.queries.getReportAnswers, {
			reportId,
			paginationOpts,
		});
		await expect(
			f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 0 }),
		).rejects.toThrow("kan ikke");
		await expect(
			f.client.mutation(reports.mutations.revoke, { reportId, revision: 0 }),
		).rejects.toThrow("ikke delt");
		await f.t.run((ctx) => ctx.db.delete(answers.page[0].id));
		await expect(
			f.client.mutation(reports.mutations.setAnswerVisibility, {
				reportId,
				revision: 0,
				answerId: answers.page[0].id,
				visible: false,
			}),
		).rejects.toThrow("finnes ikke");
		const secondReportId = await f.t.run(async (ctx) => {
			const original = await ctx.db.get(reportId);
			if (!original) throw new Error("Missing report");
			const { _id, _creationTime, ...fields } = original;
			return ctx.db.insert("feedbackReports", fields);
		});
		await expect(
			f.client.mutation(reports.mutations.setAnswerVisibility, {
				reportId: secondReportId,
				revision: 0,
				answerId: answers.page[1].id,
				visible: false,
			}),
		).rejects.toThrow("finnes ikke");
		featureFlags.huginFeedback.reportsEnabled = false;
		await expect(
			f.client.mutation(reports.mutations.revoke, { reportId, revision: 0 }),
		).rejects.toThrow("slått av");
		featureFlags.huginFeedback.reportsEnabled = true;
		vi.setSystemTime(now + 86400000);
		await expect(
			f.client.mutation(reports.mutations.revoke, { reportId, revision: 0 }),
		).rejects.toThrow("utløpt");
		vi.setSystemTime(now);
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 0,
			recipientEmail: "contact@example.test",
		});
		await expect(
			f.client.mutation(reports.mutations.approve, {
				reportId,
				revision: 1,
				recipientEmail: "different@example.test",
			}),
		).rejects.toThrow("allerede");
		await expect(
			f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 1 }),
		).rejects.toThrow("kan ikke");
	});
	it("rejects retained and removed campaigns and unapproved token records", async () => {
		const f = await fixture();
		const reportId = await queued(f);
		await f.t.run((ctx) => ctx.db.patch(reportId, { status: "draft" }));
		expect(await f.t.action(reports.public.resolveReport, { token, paginationOpts })).toBeNull();
		await f.t.run((ctx) => ctx.db.patch(reportId, { status: "approved" }));
		await f.t.run((ctx) => ctx.db.patch(f.campaignId, { retainedAt: now }));
		expect(await f.t.action(reports.public.resolveReport, { token, paginationOpts })).toBeNull();
		await f.t.run((ctx) => ctx.db.delete(f.campaignId));
		expect(await f.t.action(reports.public.resolveReport, { token, paginationOpts })).toBeNull();
	});
	it("handles rendering/configuration failures without unlocking approved reports", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		await f.t.mutation(jobs.messages.enqueue, { reportId, token, url: "", html: "" });
		await f.t.mutation(jobs.messages.failed, { reportId });
		expect(await f.t.query(jobs.messages.getDelivery, { reportId })).toBeNull();
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 0,
			recipientEmail: "contact@example.test",
		});
		vi.stubEnv("APP_ENV", "test");
		feedbackResend.config.apiKey = "";
		await f.t.action(jobs.mail.sendReportEmail, { reportId });
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			status: "approved",
			deliveryStatus: "failed",
		});
		featureFlags.huginFeedback.reportEmailsEnabled = false;
		await expect(
			f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 1 }),
		).rejects.toThrow("slått av");
		featureFlags.huginFeedback.reportEmailsEnabled = true;
		await f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 1 });
		vi.stubEnv("APP_ENV", "local");
		await f.t.action(jobs.mail.sendReportEmail, { reportId });
		await f.t.mutation(jobs.messages.failed, { reportId });
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			deliveryStatus: "queued",
		});
	});
	it("queues a real provider message and handles repeated/out-of-order delivery callbacks", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 0,
			recipientEmail: "contact@example.test",
		});
		const lead = await insertUser(f.t, "lead@example.test", {
			firstName: "Ola",
			lastName: "Nordmann",
		});
		await f.t.run((ctx) =>
			ctx.db.insert("eventOrganizers", {
				eventId: f.eventId,
				userId: lead._id,
				role: "hovedansvarlig",
			}),
		);
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");
		vi.stubEnv("APP_ENV", "test");
		feedbackResend.config.apiKey = "re_test";
		await f.t.action(jobs.mail.sendReportEmail, { reportId });
		const report = await f.t.run((ctx) => ctx.db.get(reportId));
		const emailId = report?.emailId as EmailId;
		const sent = (sendEmail.mock.calls[0] as unknown as [unknown, SendEmailOptions])[1];
		expect(sent.replyTo).toEqual(["lead@example.test"]);
		expect(sent.html).toContain("Ola Nordmann");
		expect(sent.html).toContain("mailto:lead@example.test");
		expect(await f.t.run((ctx) => feedbackResend.status(ctx, emailId))).toMatchObject({
			status: "waiting",
		});
		expect(await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect())).toEqual([]);
		for (const type of [
			"email.sent",
			"email.delivered",
			"email.bounced",
			"email.delivered",
			"email.complained",
			"email.failed",
		] as const) {
			const event = {
				type,
				created_at: new Date().toISOString(),
				data: {
					email_id: emailId,
					created_at: new Date().toISOString(),
					from: "info@ifinavet.no",
					to: ["contact@example.test"],
					subject: "Report",
					...(type === "email.bounced"
						? { bounce: { message: "Undeliverable", subType: "General", type: "Permanent" } }
						: {}),
					...(type === "email.failed" ? { failed: { reason: "failed" } } : {}),
				},
			} as EmailEvent;
			await f.t.mutation(internal.feedback.delivery.messages.onEmailEvent, { id: emailId, event });
		}
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			deliveryStatus: "failed",
		});
		await f.client.mutation(reports.mutations.revoke, { reportId, revision: 1 });
		await f.t.mutation(internal.feedback.delivery.messages.onEmailEvent, {
			id: emailId,
			event: {
				type: "email.sent",
				created_at: new Date().toISOString(),
				data: {
					email_id: emailId,
					created_at: new Date().toISOString(),
					from: "info@ifinavet.no",
					to: [],
					subject: "Report",
				},
			},
		});
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({ status: "revoked" });
	});
	it("does not queue after expiry or when the report email flag is switched off", async () => {
		const f = await fixture();
		const reportId = await f.prepare();
		await f.client.mutation(reports.mutations.approve, {
			reportId,
			revision: 0,
			recipientEmail: "contact@example.test",
		});
		featureFlags.huginFeedback.reportEmailsEnabled = false;
		await f.t.mutation(jobs.messages.enqueue, { reportId, token, url: "", html: "" });
		expect(await f.t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
			deliveryStatus: "failed",
		});
		featureFlags.huginFeedback.reportEmailsEnabled = true;
		await f.client.mutation(reports.mutations.retryDelivery, { reportId, revision: 1 });
		vi.setSystemTime(now + 86400000);
		await f.t.mutation(jobs.messages.enqueue, { reportId, token, url: "", html: "" });
		expect(await f.t.run((ctx) => ctx.db.query("feedbackReportLocalEmails").collect())).toEqual([]);
	});
});
