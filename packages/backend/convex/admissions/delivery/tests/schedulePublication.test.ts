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
			if (!rawEmail.idempotencyKey) throw new Error("Interview email had no idempotency key");
			sentEmails.push(rawEmail);
			return `email:${rawEmail.idempotencyKey}` as EmailId;
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
	const publicationEmails = [...sentEmails];
	const assertEmailMatchesInterview = (
		email: SendEmailOptions,
		expectedApplicant: (typeof applicants)[number],
	) => {
		const recipient = typeof email.to === "string" ? email.to : email.to[0];
		if (!recipient) throw new Error("Email had no recipient");
		expect(recipient).toBe(expectedApplicant.email);
		const interview = interviews.find(
			({ applicationId }) => applicationId === expectedApplicant.applicationId,
		);
		if (!interview) throw new Error("Applicant email has no matching interview");
		if (typeof email.text !== "string") throw new Error("Interview invitation had no text body");
		expect(email.text).toContain(formatOsloDate(interview.startAt, "EEEE d. MMMM yyyy, HH:mm"));
		expect(email.text).toContain(interview.room);
		return interview;
	};
	const publicationRecipients = publicationEmails.map((email) => {
		const recipient = typeof email.to === "string" ? email.to : email.to[0];
		const applicant = applicants.find(({ email: address }) => address === recipient);
		if (!applicant) throw new Error(`Email sent to an unknown applicant: ${recipient}`);
		assertEmailMatchesInterview(email, applicant);
		return recipient;
	});
	expect([...publicationRecipients].sort()).toEqual(applicants.map(({ email }) => email).sort());
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
	const reminderOperations = (await t.run((ctx) => allOperations(ctx))).filter(
		({ kind }) => kind === "remind_3d" || kind === "remind_1d",
	);
	expect(reminderOperations).toHaveLength(20);
	const threeDayReminders = reminderOperations
		.filter(({ kind }) => kind === "remind_3d")
		.sort((a, b) => a.dueAt - b.dueAt);
	const oneDayReminders = reminderOperations
		.filter(({ kind }) => kind === "remind_1d")
		.sort((a, b) => a.dueAt - b.dueAt);
	expect(threeDayReminders).toHaveLength(10);
	expect(oneDayReminders).toHaveLength(10);
	for (const reminder of reminderOperations) {
		const interview = reminder.interviewId ? byId.get(reminder.interviewId) : undefined;
		if (!interview) throw new Error("Reminder did not reference a stored interview");
		expect(reminder.dueAt).toBe(
			interview.startAt - (reminder.kind === "remind_3d" ? 3 : 1) * 86400000,
		);
	}
	const slackNoticeCount = () =>
		slackCalls.filter(({ method }) => method === "chat.postMessage").length;
	for (const reminder of threeDayReminders) {
		vi.setSystemTime(reminder.dueAt);
		await t.action(internal.admissions.delivery.actions.execute, {
			operation: await operationArgs(t, reminder.idempotencyKey),
		});
	}
	expect(sendEmail).toHaveBeenCalledTimes(20);
	expect(slackNoticeCount()).toBe(10);
	for (const email of sentEmails.slice(10)) {
		const recipient = typeof email.to === "string" ? email.to : email.to[0];
		const applicant = applicants.find(({ email: address }) => address === recipient);
		if (!applicant) throw new Error(`Reminder sent to an unknown applicant: ${recipient}`);
		assertEmailMatchesInterview(email, applicant);
		expect(email.idempotencyKey).toBe(
			`admission:interview:${interviews.find(({ applicationId }) => applicationId === applicant.applicationId)?._id}:1:reminder-3d`,
		);
	}

	const cancelledApplicant = applicants[0];
	if (!cancelledApplicant) throw new Error("Missing applicant for cancellation check");
	const cancelledInterview = interviews.find(
		({ applicationId }) => applicationId === cancelledApplicant.applicationId,
	);
	if (!cancelledInterview) throw new Error("Cancellation applicant has no interview");
	const application = await t.run((ctx) => ctx.db.get(cancelledApplicant.applicationId));
	if (!application) throw new Error("Cancellation applicant has no application");
	await asUser(t, cancelledApplicant).mutation(api.admissions.mutations.cancelInterview, {
		applicationId: cancelledApplicant.applicationId,
		expectedRevision: application.revision,
		idempotencyKey: "cancel-before-one-day-reminder",
	});

	for (const reminder of oneDayReminders) {
		vi.setSystemTime(reminder.dueAt);
		await t.action(internal.admissions.delivery.actions.execute, {
			operation: await operationArgs(t, reminder.idempotencyKey),
		});
	}
	expect(sendEmail).toHaveBeenCalledTimes(29);
	expect(slackNoticeCount()).toBe(19);
	const oneDayEmails = sentEmails.slice(20);
	const oneDayRecipients = oneDayEmails.map((email) => {
		const recipient = typeof email.to === "string" ? email.to : email.to[0];
		const applicant = applicants.find(({ email: address }) => address === recipient);
		if (!applicant) throw new Error(`Reminder sent to an unknown applicant: ${recipient}`);
		assertEmailMatchesInterview(email, applicant);
		return recipient;
	});
	expect([...oneDayRecipients].sort()).toEqual(
		applicants
			.filter(({ applicationId }) => applicationId !== cancelledApplicant.applicationId)
			.map(({ email }) => email)
			.sort(),
	);
	const reminderDeliveries = await t.run((ctx) =>
		ctx.db
			.query("admissionDeliveries")
			.filter((q) => q.eq(q.field("periodId"), periodId))
			.collect(),
	);
	const threeDayDeliveries = reminderDeliveries.filter(({ kind }) => kind === "reminder_3d");
	const oneDayDeliveries = reminderDeliveries.filter(({ kind }) => kind === "reminder_1d");
	expect(threeDayDeliveries).toHaveLength(10);
	expect(oneDayDeliveries).toHaveLength(9);
	const deliveriesPerApplication = new Map<string, { reminder_3d: number; reminder_1d: number }>();
	for (const [days, deliveries] of [
		[3, threeDayDeliveries],
		[1, oneDayDeliveries],
	] as const) {
		for (const delivery of deliveries) {
			const interview = interviews.find(
				({ applicationId }) => applicationId === delivery.applicationId,
			);
			if (!interview) throw new Error("Reminder delivery has no interview");
			const count = deliveriesPerApplication.get(delivery.applicationId) ?? {
				reminder_3d: 0,
				reminder_1d: 0,
			};
			count[days === 3 ? "reminder_3d" : "reminder_1d"]++;
			deliveriesPerApplication.set(delivery.applicationId, count);
			expect(delivery).toMatchObject({
				status: "queued",
				idempotencyKey: `admission:interview:${interview._id}:1:reminder-${days}d`,
			});
		}
	}
	for (const applicant of applicants) {
		expect(deliveriesPerApplication.get(applicant.applicationId)).toEqual({
			reminder_3d: 1,
			reminder_1d: applicant.applicationId === cancelledApplicant.applicationId ? 0 : 1,
		});
	}
});
