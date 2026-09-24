import type { SendEmailOptions } from "@convex-dev/resend";
import { HUGIN_URL } from "@workspace/shared/constants";
import { featureFlags } from "@workspace/shared/feature-flags";
import type { ReportTextAnswer } from "@workspace/shared/feedback/report";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertFeedbackResponses } from "../../../test/feedbackResponses";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertEvent,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { hashLinkToken } from "../../lib/tokens";
import { defaultFeedbackFields } from "../defaultFields";
import { feedbackResend } from "../delivery/messages";

const reportsEnabled = featureFlags.huginFeedback.reportsEnabled;
const paginationOpts = { cursor: null, numItems: 100 };
const companyToken = "c".repeat(43);

async function fixture(email: string, role?: "internal", { publishForm = true } = {}) {
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "super@ifinavet.no");
	await grantRole(t, admin._id, "super-admin");
	const adminClient = asUser(t, admin);
	let formVersionId: Id<"formVersions"> | undefined;
	if (publishForm) {
		const formId = await adminClient.mutation(api.feedback.forms.mutations.saveDraft, {
			name: "Feedback",
			fields: defaultFeedbackFields,
		});
		formVersionId = await adminClient.mutation(api.feedback.forms.mutations.publish, { formId });
		await adminClient.mutation(api.feedback.forms.mutations.setDefault, { formId });
	}
	const user = await insertUser(t, email);
	if (role) await grantRole(t, user._id, role);
	const eventId = await insertEvent(t, companyId, {
		title: "Bedpres med Testbedrift",
		eventStart: Date.UTC(2025, 2, 14, 16),
	});
	return { t, eventId, formVersionId, adminClient, client: asUser(t, user) };
}

async function sendAndCollect(f: Awaited<ReturnType<typeof fixture>>) {
	const sendEmail = vi.spyOn(feedbackResend, "sendEmail");
	await f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId });
	return sendEmail.mock.calls.map((call) => (call as unknown as [unknown, SendEmailOptions])[1]);
}

function reportTokenFrom(html: string | undefined) {
	const token = html?.match(/\/report#token=([\w-]+)/)?.[1];
	if (!token) throw new Error("No report link in the email");
	return token;
}

async function insertClosedCampaignWithResponses(
	t: TestBackend,
	eventId: Id<"events">,
	formVersionId: Id<"formVersions">,
) {
	const now = Date.now();
	const participant = await insertUser(t, "participant@example.test");
	return t.run(async (ctx) => {
		const campaignId = await ctx.db.insert("feedbackCampaigns", {
			eventId,
			formVersionId,
			status: "closed",
			opensAt: now - 14 * DAY_IN_MS,
			closesAt: now,
			closedAt: now,
			retentionAt: now + DAY_IN_MS,
			generation: 1,
		});
		await insertFeedbackResponses(ctx, {
			campaignId,
			formVersionId,
			userId: participant._id,
			count: 3,
			submittedAt: now - 1,
		});
		return campaignId;
	});
}

async function approveRealReport(
	f: Awaited<ReturnType<typeof fixture>>,
	campaignId: Id<"feedbackCampaigns">,
) {
	const reportId = await f.adminClient.mutation(api.feedback.reports.build.prepare, {
		campaignId,
	});
	let cursor: string | null = null;
	for (;;) {
		await f.t.mutation(internal.feedback.reports.build.buildReportBatch, { reportId, cursor });
		const report = await f.t.run((ctx) => ctx.db.get(reportId));
		if (report?.status !== "building") break;
		cursor = report.buildCursor;
	}
	const tokenHash = await hashLinkToken(companyToken);
	await f.t.run((ctx) => ctx.db.patch(reportId, { status: "approved", tokenHash }));
}

const withoutIds = (answers: ReportTextAnswer[]) => answers.map(({ id: _id, ...answer }) => answer);

describe("feedback test send", () => {
	beforeEach(() => {
		vi.stubEnv("APP_ENV", "test");
		feedbackResend.config.apiKey = "re_test";
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		vi.useRealTimers();
		featureFlags.huginFeedback.reportsEnabled = reportsEnabled;
	});

	it("sends the invitation, a reminder and the report email for a past event to the caller", async () => {
		const f = await fixture("Admin@IFINAVET.no", "internal");
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(await f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId })).toBe(3);

		const sent = sendEmail.mock.calls.map(
			(call) => (call as unknown as [unknown, SendEmailOptions])[1],
		);
		expect(sent.map(({ to, subject }) => ({ to, subject }))).toEqual([
			{ to: "Admin@IFINAVET.no", subject: "Tilbakemelding: Bedpres med Testbedrift" },
			{ to: "Admin@IFINAVET.no", subject: "Påminnelse: Bedpres med Testbedrift" },
			{ to: "Admin@IFINAVET.no", subject: "Rapport fra Bedpres med Testbedrift" },
		]);
		for (const email of sent) {
			expect(email).toMatchObject({
				from: "Navet <info@ifinavet.no>",
				replyTo: ["arrangement@ifinavet.no"],
			});
		}
		expect(sent[0]?.html).toContain(`${HUGIN_URL}/feedback#token=`);
		expect(sent[0]?.html).toContain("bedriftspresentasjonen med Testbedrift!");
		expect(sent[2]?.html).toContain(`${HUGIN_URL}/report#token=`);
		expect(sent[2]?.html).toContain("14. mars");
	});

	it("opens the same report through the test link as the company sees once approved", async () => {
		featureFlags.huginFeedback.reportsEnabled = true;
		const f = await fixture("admin@ifinavet.no", "internal");
		const campaignId = await insertClosedCampaignWithResponses(f.t, f.eventId, f.formVersionId!);
		await approveRealReport(f, campaignId);
		const sent = await sendAndCollect(f);

		const company = await f.t.action(api.feedback.reports.public.resolveReport, {
			token: companyToken,
			paginationOpts,
		});
		const preview = await f.t.action(api.feedback.reports.public.resolveReport, {
			token: reportTokenFrom(sent[2]?.html),
			paginationOpts,
		});

		expect(company?.report.totalResponses).toBe(3);
		expect(preview?.report).toEqual(company?.report);
		expect(withoutIds(preview?.answers ?? [])).toEqual(withoutIds(company?.answers ?? []));
		expect(preview?.isDone).toBe(true);
	});

	it("previews an empty report from the default form when the event has no campaign", async () => {
		const f = await fixture("admin@ifinavet.no", "internal");
		const sent = await sendAndCollect(f);

		const preview = await f.t.action(api.feedback.reports.public.resolveReport, {
			token: reportTokenFrom(sent[2]?.html),
			paginationOpts,
		});

		expect(preview?.report).toMatchObject({
			eventTitle: "Bedpres med Testbedrift",
			totalResponses: 0,
		});
		expect(preview?.report.questions.map(({ key }) => key)).toEqual(
			defaultFeedbackFields.map(({ key }) => key),
		);
		expect(preview?.answers).toEqual([]);
	});

	it("stops opening the test report after a week and deletes the link", async () => {
		vi.useFakeTimers();
		const f = await fixture("admin@ifinavet.no", "internal");
		const sent = await sendAndCollect(f);
		const token = reportTokenFrom(sent[2]?.html);

		vi.advanceTimersByTime(7 * DAY_IN_MS);
		expect(
			await f.t.action(api.feedback.reports.public.resolveReport, { token, paginationOpts }),
		).toBeNull();
		await f.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await f.t.run((ctx) => ctx.db.query("feedbackTestReportLinks").collect())).toEqual([]);
	});

	it("stores only the test report link, no feedback links, deliveries or reports", async () => {
		const f = await fixture("admin@ifinavet.no", "internal");
		await f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId });

		const stored = await f.t.run(async (ctx) => ({
			tokens: await ctx.db.query("feedbackTokens").collect(),
			deliveries: await ctx.db.query("feedbackDeliveries").collect(),
			reports: await ctx.db.query("feedbackReports").collect(),
			testLinks: await ctx.db.query("feedbackTestReportLinks").collect(),
		}));
		expect(stored).toMatchObject({ tokens: [], deliveries: [], reports: [] });
		expect(stored.testLinks).toHaveLength(1);
	});

	it("creates and publishes the default form once when none exists", async () => {
		const f = await fixture("admin@ifinavet.no", "internal", { publishForm: false });
		const sent = await sendAndCollect(f);
		await f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId });

		const preview = await f.t.action(api.feedback.reports.public.resolveReport, {
			token: reportTokenFrom(sent[2]?.html),
			paginationOpts,
		});
		const forms = await f.t.run((ctx) => ctx.db.query("feedbackForms").collect());

		expect(sent).toHaveLength(3);
		expect(forms).toMatchObject([{ name: "Standardskjema", isDefault: true }]);
		expect(preview?.report.questions.map(({ key }) => key)).toEqual(
			defaultFeedbackFields.map(({ key }) => key),
		);
	});

	it("refuses to send for an event that does not exist", async () => {
		const f = await fixture("admin@ifinavet.no", "internal");
		await f.t.run((ctx) => ctx.db.delete(f.eventId));
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(
			await refusalMessageFrom(
				f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId }),
			),
		).toBe("Fant ikke arrangementet.");
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("refuses to send for an event whose company does not exist", async () => {
		const f = await fixture("admin@ifinavet.no", "internal");
		await f.t.run(async (ctx) => {
			const event = await ctx.db.get(f.eventId);
			if (event) await ctx.db.delete(event.hostingCompany);
		});
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(
			await refusalMessageFrom(
				f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId }),
			),
		).toBe("Fant ikke bedriften.");
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("opens nothing through the test link once the event is deleted", async () => {
		const f = await fixture("admin@ifinavet.no", "internal");
		const sent = await sendAndCollect(f);
		await f.t.run((ctx) => ctx.db.delete(f.eventId));

		expect(
			await f.t.action(api.feedback.reports.public.resolveReport, {
				token: reportTokenFrom(sent[2]?.html),
				paginationOpts,
			}),
		).toBeNull();
	});

	it("refuses callers without an internal role", async () => {
		const f = await fixture("admin@ifinavet.no");
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(
			await refusalMessageFrom(
				f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId }),
			),
		).toContain("Unauthorized");
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("refuses internal users outside the ifinavet.no domain", async () => {
		const f = await fixture("admin@ifinavet.no.example.test", "internal");
		const sendEmail = vi.spyOn(feedbackResend, "sendEmail");

		expect(
			await refusalMessageFrom(
				f.client.action(api.feedback.testSend.send.send, { eventId: f.eventId }),
			),
		).toBe("Testutsending krever en @ifinavet.no-adresse.");
		expect(sendEmail).not.toHaveBeenCalled();
	});
});
