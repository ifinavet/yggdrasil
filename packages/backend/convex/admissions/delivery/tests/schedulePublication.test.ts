import type { EmailId, SendEmailOptions } from "@convex-dev/resend";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { afterEach, expect, it, vi } from "vitest";
import { applicationFields, periodFields } from "../../../../test/admissions-fixtures";
import { allOperations, operationArgs } from "../../../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../../../test/fixtures";
import { api, internal } from "../../../_generated/api";
import * as config from "../../../iam/config";
import * as google from "../../../iam/googleCalendar";
import { trackedEmail } from "../../../lib/trackedEmail";

const provider = {
	listCalendars: vi.fn(),
	freeBusy: vi.fn(),
	listEvents: vi.fn(),
	getEvent: vi.fn(),
	upsertEvent: vi.fn(),
	cancelEvent: vi.fn(),
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isSendEmailOptions(value: unknown): value is SendEmailOptions {
	return (
		isObject(value) &&
		typeof value.from === "string" &&
		(typeof value.to === "string" || Array.isArray(value.to)) &&
		typeof value.subject === "string" &&
		typeof value.text === "string"
	);
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

it("generates and publishes ten interviews through the delivery actions", async () => {
	vi.useFakeTimers();
	vi.setSystemTime(Date.parse("2026-10-05T08:00:00Z"));
	vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
	vi.spyOn(config, "googleConfig").mockReturnValue({
		serviceAccountEmail: "service@example.test",
		privateKey: "test-key",
		adminEmail: "admin@ifinavet.no",
		domain: "ifinavet.no",
	});
	vi.spyOn(google, "googleCalendarClient").mockReturnValue(provider);
	provider.freeBusy.mockImplementation(async (ids: string[]) =>
		Object.fromEntries(ids.map((id) => [id, { busy: [] }])),
	);
	provider.listEvents.mockResolvedValue([]);
	provider.upsertEvent.mockResolvedValue(undefined);
	const sentEmails: SendEmailOptions[] = [];
	const sendEmail = vi
		.spyOn(trackedEmail, "sendEmail")
		.mockImplementation(async (_ctx, rawEmail) => {
			if (!isSendEmailOptions(rawEmail)) throw new Error("Unexpected interview email options");
			const email = rawEmail;
			const recipient = typeof email.to === "string" ? email.to : email.to.join(",");
			sentEmails.push(email);
			return `email:${recipient}` as EmailId;
		});

	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const interviewers = await Promise.all(
		["one@ifinavet.no", "two@ifinavet.no"].map(async (email) => {
			const user = await insertUser(t, email);
			await grantRole(t, user._id, "internal");
			return { ...user, email };
		}),
	);
	const day = "2026-10-12";
	const startAt = osloDateTimeToEpoch(day, "09:00");
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				applicationStartAt: Date.now() - 86400000,
				applicationEndAt: Date.now() + 86400000,
				interviewStartAt: startAt,
				interviewEndAt: osloDateTimeToEpoch(day, "16:00"),
				retentionAt: Date.now() + 1209600000,
				revision: 1,
				interviewers: interviewers.map(({ _id }) => ({
					userId: _id,
					selectedCalendarIds: ["navet"],
				})),
				lunch: true,
			}),
		),
	);
	const applicants = await Promise.all(
		Array.from({ length: 10 }, async (_, index) => {
			const user = await insertUser(t, `applicant-${index}@uio.no`, {
				firstName: `Applicant${index}`,
			});
			const applicationId = await t.run((ctx) =>
				ctx.db.insert(
					"admissionApplications",
					applicationFields(periodId, user._id, {
						availability: [{ day, start: 540, end: 960 }],
					}),
				),
			);
			return { ...user, email: user.externalId, applicationId };
		}),
	);
	const slackCalls: Array<{ method: string; params: URLSearchParams }> = [];
	const channelMembers = ["U-bot"];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const method = String(input).split("/").at(-1);
			const params = new URLSearchParams(String(init?.body ?? ""));
			slackCalls.push({ method: method ?? "", params });
			if (method === "conversations.create")
				return Response.json({ ok: true, channel: { id: "C-admissions" } });
			if (method === "conversations.info")
				return Response.json({
					ok: true,
					channel: { name: "h26-opptak", purpose: { value: `admissions:${periodId}` } },
				});
			if (method === "auth.test") return Response.json({ ok: true, user_id: "U-bot" });
			if (method === "conversations.members")
				return Response.json({ ok: true, members: channelMembers });
			if (method === "users.lookupByEmail")
				return Response.json({ ok: true, user: { id: `U-${params.get("email")}` } });
			if (method === "conversations.invite") {
				channelMembers.push(params.get("users") ?? "");
				return Response.json({ ok: true });
			}
			if (method === "conversations.history") return Response.json({ ok: true, messages: [] });
			if (method === "chat.postMessage") return Response.json({ ok: true });
			throw new Error(`Unexpected Slack API method: ${method}`);
		}),
	);

	expect(await t.run((ctx) => ctx.db.query("admissionInterviews").collect())).toEqual([]);
	const adminClient = asUser(t, admin);
	expect(
		await adminClient.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 1,
		}),
	).toEqual({ count: 10 });
	const period = await t.run((ctx) => ctx.db.get(periodId));
	if (!period) throw new Error("Missing admission period");
	expect(
		await adminClient.mutation(api.admissions.mutations.publish, {
			periodId,
			expectedRevision: period.revision,
		}),
	).toEqual({ count: 10, revision: period.revision + 1 });

	const publishOperations = await t.run((ctx) => allOperations(ctx));
	const publications = publishOperations.filter(({ kind }) => kind === "publish");
	expect(publications).toHaveLength(10);
	for (const { idempotencyKey } of publications) {
		await t.action(internal.admissions.delivery.actions.execute, {
			operation: await operationArgs(t, idempotencyKey),
		});
	}

	const interviews = await t.run((ctx) =>
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "scheduled"),
			)
			.collect(),
	);
	expect(interviews).toHaveLength(10);
	const byId = new Map(interviews.map((interview) => [interview._id, interview]));
	const ordered = [...interviews].sort((a, b) => a.startAt - b.startAt);
	for (const [index, interview] of ordered.entries()) {
		expect(new Set(interview.interviewerIds)).toEqual(new Set(interviewers.map(({ _id }) => _id)));
		expect(interview.startAt).toBeGreaterThanOrEqual(startAt);
		expect(interview.endAt).toBeLessThanOrEqual(osloDateTimeToEpoch(day, "16:00"));
		expect(
			interview.startAt >= osloDateTimeToEpoch(day, "12:00") &&
				interview.startAt < osloDateTimeToEpoch(day, "12:30"),
		).toBe(false);
		expect(
			interview.endAt > osloDateTimeToEpoch(day, "12:00") &&
				interview.startAt < osloDateTimeToEpoch(day, "12:30"),
		).toBe(false);
		expect(interview.endAt - interview.startAt).toBe(15 * 60_000);
		expect(interview.room).toBe("Beta");
		const previous = ordered[index - 1];
		if (previous) expect(interview.startAt).toBeGreaterThanOrEqual(previous.endAt + 5 * 60_000);
		expect(interview.publishedAt).toBe(Date.now());
		expect(interview.calendarEventId).toBeTruthy();
	}
	expect(provider.upsertEvent).toHaveBeenCalledTimes(10);
	const eventsPerApplication = new Map<string, number>();
	for (const [calendar, eventId, event] of provider.upsertEvent.mock.calls) {
		const interview = interviews.find(({ calendarEventId }) => calendarEventId === eventId);
		if (!interview) throw new Error("Calendar event did not reference a stored interview");
		const applicant = applicants.find(
			({ applicationId }) => applicationId === interview.applicationId,
		);
		if (!applicant) throw new Error("Interview has no matching applicant");
		expect(calendar).toBe("primary");
		expect(eventId).toBe(interview.calendarEventId);
		expect(event).toMatchObject({
			start: { dateTime: new Date(interview.startAt).toISOString() },
			end: { dateTime: new Date(interview.endAt).toISOString() },
			location: interview.room,
			extendedProperties: { shared: { navetAdmissionsInterviewId: interview._id } },
		});
		eventsPerApplication.set(
			interview.applicationId,
			(eventsPerApplication.get(interview.applicationId) ?? 0) + 1,
		);
		const nonOwner = interview.interviewerIds.find((id) => id !== interview.interviewerIds[0]);
		const nonOwnerEmail = interviewers.find(({ _id }) => _id === nonOwner)?.email;
		expect(event.attendees).toHaveLength(2);
		expect(event.attendees).toEqual(
			expect.arrayContaining([{ email: applicant.email }, { email: nonOwnerEmail }]),
		);
	}
	expect([...eventsPerApplication.values()]).toEqual(Array(10).fill(1));
	expect(sendEmail).toHaveBeenCalledTimes(10);
	const emailsPerApplicant = new Map<string, number>();
	for (const email of sentEmails) {
		const recipient = typeof email.to === "string" ? email.to : email.to[0];
		if (!recipient) throw new Error("Email had no recipient");
		const applicant = applicants.find(({ email: address }) => address === recipient);
		if (!applicant) throw new Error(`Email sent to an unknown applicant: ${recipient}`);
		const interview = interviews.find(
			({ applicationId }) => applicationId === applicant.applicationId,
		);
		if (!interview) throw new Error("Applicant email has no matching interview");
		if (typeof email.text !== "string") throw new Error("Interview invitation had no text body");
		expect(email.text).toContain(formatOsloDate(interview.startAt, "EEEE d. MMMM yyyy, HH:mm"));
		emailsPerApplicant.set(recipient, (emailsPerApplicant.get(recipient) ?? 0) + 1);
	}
	expect(applicants.map(({ email }) => emailsPerApplicant.get(email))).toEqual(Array(10).fill(1));
	expect(
		slackCalls
			.filter(({ method }) => method === "conversations.invite")
			.map(({ params }) => params.get("users"))
			.sort(),
	).toEqual(interviewers.map(({ email }) => `U-${email}`).sort());
	expect(slackCalls.filter(({ method }) => method === "chat.postMessage")).toHaveLength(10);
	expect(
		slackCalls
			.filter(({ method }) => method === "chat.postMessage")
			.every(({ params }) => params.get("channel") === "C-admissions"),
	).toBe(true);
	const reminders = (await t.run((ctx) => allOperations(ctx))).filter(
		({ kind }) => kind === "remind_3d" || kind === "remind_1d",
	);
	expect(reminders).toHaveLength(20);
	expect(reminders.filter(({ kind }) => kind === "remind_3d")).toHaveLength(10);
	expect(reminders.filter(({ kind }) => kind === "remind_1d")).toHaveLength(10);
	for (const reminder of reminders) {
		const interview = reminder.interviewId ? byId.get(reminder.interviewId) : undefined;
		if (!interview) throw new Error("Reminder did not reference a stored interview");
		expect(reminder.dueAt).toBe(
			interview.startAt - (reminder.kind === "remind_3d" ? 3 : 1) * 86400000,
		);
	}
});
