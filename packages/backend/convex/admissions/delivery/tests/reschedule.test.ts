import type { EmailId, SendEmailOptions } from "@convex-dev/resend";
import { osloDateTimeToEpoch } from "@workspace/shared/time";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationFields, periodFields } from "../../../../test/admissions-fixtures";
import {
	allOperations,
	finishOperation,
	operationArgs,
} from "../../../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../../../test/fixtures";
import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import * as config from "../../../iam/config";
import * as google from "../../../iam/googleCalendar";
import { trackedEmail } from "../../../lib/trackedEmail";

const calendars = new Map<string, ReturnType<typeof calendarClient>>();

function calendarClient() {
	return {
		listCalendars: vi.fn(),
		freeBusy: vi.fn(async (ids: string[]) =>
			Object.fromEntries(ids.map((id) => [id, { busy: [] }])),
		),
		listEvents: vi.fn(async () => []),
		getEvent: vi.fn(),
		upsertEvent: vi.fn(async () => undefined),
		cancelEvent: vi.fn(async () => undefined),
	};
}

function calendarFor(email: string) {
	const existing = calendars.get(email);
	if (existing) return existing;
	const client = calendarClient();
	calendars.set(email, client);
	return client;
}

const sentEmails: SendEmailOptions[] = [];
const slackMessages: string[] = [];
let channelPeriodId = "";

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(Date.parse("2026-10-05T08:00:00Z"));
	vi.stubEnv("SLACK_BOT_TOKEN", "test-token");
	vi.spyOn(config, "googleConfig").mockReturnValue({
		serviceAccountEmail: "service@example.test",
		privateKey: "test-key",
		adminEmail: "admin@ifinavet.no",
		domain: "ifinavet.no",
	});
	vi.spyOn(google, "googleCalendarClient").mockImplementation((_config, email) =>
		calendarFor(email),
	);
	vi.spyOn(trackedEmail, "sendEmail").mockImplementation(async (_ctx, email) => {
		const options = email as SendEmailOptions;
		sentEmails.push(options);
		return `email:${options.idempotencyKey}` as EmailId;
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const method = String(input).split("/").at(-1);
			const params = new URLSearchParams(String(init?.body ?? ""));
			if (method === "conversations.create")
				return Response.json({ ok: true, channel: { id: "C-admissions" } });
			if (method === "conversations.info")
				return Response.json({
					ok: true,
					channel: { name: "h26-opptak", purpose: { value: `admissions:${channelPeriodId}` } },
				});
			if (method === "auth.test") return Response.json({ ok: true, user_id: "U-bot" });
			if (method === "conversations.members") return Response.json({ ok: true, members: [] });
			if (method === "users.lookupByEmail")
				return Response.json({ ok: true, user: { id: `U-${params.get("email")}` } });
			if (method === "chat.postMessage") slackMessages.push(params.get("text") ?? "");
			return Response.json({ ok: true, messages: [] });
		}),
	);
});

afterEach(() => {
	calendars.clear();
	sentEmails.length = 0;
	slackMessages.length = 0;
	vi.restoreAllMocks();
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

const day = "2026-10-12";

async function publishedInterview() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const interviewers = await Promise.all(
		["one@ifinavet.no", "two@ifinavet.no", "three@ifinavet.no"].map(async (email) => {
			const user = await insertUser(t, email);
			await grantRole(t, user._id, "internal");
			return { ...user, email };
		}),
	);
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				applicationStartAt: Date.now() - 86400000,
				applicationEndAt: Date.now() + 86400000,
				interviewStartAt: osloDateTimeToEpoch(day, "09:00"),
				interviewEndAt: osloDateTimeToEpoch(day, "16:00"),
				retentionAt: Date.now() + 1209600000,
				revision: 1,
				interviewers: interviewers.map(({ _id }) => ({
					userId: _id,
					selectedCalendarIds: ["navet"],
				})),
			}),
		),
	);
	channelPeriodId = periodId;
	const applicant = await insertUser(t, "applicant@uio.no", { firstName: "Applicant" });
	const applicationId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, applicant._id, {
				availability: [{ day, start: 540, end: 960 }],
			}),
		),
	);
	const adminClient = asUser(t, admin);
	const [first, second] = interviewers;
	if (!first || !second) throw new Error("Missing interviewers");
	const application = await t.run((ctx) => ctx.db.get(applicationId));
	if (!application) throw new Error("Missing application");
	await adminClient.mutation(api.admissions.mutations.scheduleInterview, {
		applicationId,
		expectedRevision: application.revision,
		expectedPeriodRevision: 1,
		startAt: osloDateTimeToEpoch(day, "10:00"),
		interviewerIds: [first._id, second._id],
	});
	const period = await t.run((ctx) => ctx.db.get(periodId));
	if (!period) throw new Error("Missing period");
	await adminClient.mutation(api.admissions.mutations.publish, {
		periodId,
		expectedRevision: period.revision,
	});
	await runOperations(t, "publish");
	const interview = await t.run((ctx) =>
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.unique(),
	);
	if (!interview?.publishedAt || !interview.calendarEventId) throw new Error("Not published");
	sentEmails.length = 0;
	slackMessages.length = 0;
	return { t, adminClient, interviewers, periodId, applicationId, interview };
}

type Backend = Awaited<ReturnType<typeof setup>>["t"];

async function runOperations(t: Backend, kind: string, rescheduled?: boolean) {
	const operations = (await t.run((ctx) => allOperations(ctx))).filter(
		(operation) =>
			operation.kind === kind &&
			(rescheduled === undefined || operation.rescheduled === rescheduled),
	);
	for (const { idempotencyKey } of operations) {
		await t.action(internal.admissions.delivery.actions.execute, {
			operation: await operationArgs(t, idempotencyKey),
		});
		await finishOperation(t, idempotencyKey);
	}
	return operations;
}

async function move(
	setupResult: Awaited<ReturnType<typeof publishedInterview>>,
	interviewerIds: Id<"users">[],
) {
	const { t, adminClient, periodId, applicationId } = setupResult;
	const [period, application] = await t.run(async (ctx) =>
		Promise.all([ctx.db.get(periodId), ctx.db.get(applicationId)]),
	);
	if (!period || !application) throw new Error("Missing records");
	await adminClient.mutation(api.admissions.mutations.scheduleInterview, {
		applicationId,
		expectedRevision: application.revision,
		expectedPeriodRevision: period.revision,
		startAt: osloDateTimeToEpoch(day, "13:00"),
		interviewerIds,
		confirmPublishedReschedule: true,
	});
}

it("republishes a moved interview at once and keeps the calendar event with the same owner", async () => {
	const context = await publishedInterview();
	const [first, second, third] = context.interviewers;
	if (!first || !second || !third) throw new Error("Missing interviewers");
	await move(context, [third._id, first._id]);

	const period = await context.t.run((ctx) => ctx.db.get(context.periodId));
	expect(period?.status).toBe("published");
	const moved = await runOperations(context.t, "publish", true);
	expect(moved).toHaveLength(1);

	const interview = await context.t.run((ctx) => ctx.db.get(context.interview._id));
	expect(interview).toMatchObject({
		revision: context.interview.revision + 1,
		interviewerIds: [first._id, third._id],
		calendarEventId: context.interview.calendarEventId,
		calendarOwnerId: first._id,
		startAt: osloDateTimeToEpoch(day, "13:00"),
	});
	expect(interview?.publishedAt).toBe(Date.now());
	expect(calendarFor(first.email).cancelEvent).not.toHaveBeenCalled();
	expect(calendarFor(first.email).upsertEvent).toHaveBeenLastCalledWith(
		"primary",
		context.interview.calendarEventId,
		expect.objectContaining({
			start: expect.objectContaining({
				dateTime: new Date(osloDateTimeToEpoch(day, "13:00")).toISOString(),
			}),
			attendees: expect.arrayContaining([{ email: third.email }]),
		}),
	);
	expect(sentEmails).toHaveLength(1);
	expect(sentEmails[0]?.subject).toMatch(/^Ny intervjutid/);
	expect(sentEmails[0]?.text).toContain("har fått ny tid");
	expect(slackMessages.some((text) => text.startsWith("Intervju flyttet til"))).toBe(true);

	const reminders = (await context.t.run((ctx) => allOperations(ctx))).filter(
		(operation) => operation.kind === "remind_3d" || operation.kind === "remind_1d",
	);
	expect(new Set(reminders.map(({ revision }) => revision))).toEqual(
		new Set([context.interview.revision, context.interview.revision + 1]),
	);
	sentEmails.length = 0;
	for (const reminder of reminders.filter(
		({ revision }) => revision === context.interview.revision,
	))
		await context.t.action(internal.admissions.delivery.actions.execute, {
			operation: await operationArgs(context.t, reminder.idempotencyKey),
		});
	expect(sentEmails).toHaveLength(0);
});

it("moves the calendar event to a new owner when the old owner leaves the interview", async () => {
	const context = await publishedInterview();
	const [first, second, third] = context.interviewers;
	if (!first || !second || !third) throw new Error("Missing interviewers");
	const owner = context.interview.calendarOwnerId ?? context.interview.interviewerIds[0];
	const oldOwner = context.interviewers.find(({ _id }) => _id === owner);
	if (!oldOwner) throw new Error("Missing owner");
	const remaining = context.interviewers.filter(({ _id }) => _id !== owner).map(({ _id }) => _id);
	calendarFor(oldOwner.email).getEvent.mockResolvedValue({
		extendedProperties: {
			shared: {
				navetAdmissionsPeriodId: context.periodId,
				navetAdmissionsInterviewId: context.interview._id,
			},
		},
	});
	await move(context, remaining);
	await runOperations(context.t, "publish", true);

	const interview = await context.t.run((ctx) => ctx.db.get(context.interview._id));
	const newOwner = context.interviewers.find(({ _id }) => _id === remaining[0]);
	if (!newOwner || !interview?.calendarEventId) throw new Error("Missing new owner");
	expect(calendarFor(oldOwner.email).cancelEvent).toHaveBeenCalledWith(
		"primary",
		context.interview.calendarEventId,
	);
	expect(interview.calendarEventId).not.toBe(context.interview.calendarEventId);
	expect(interview.calendarOwnerId).toBe(newOwner._id);
	expect(calendarFor(newOwner.email).upsertEvent).toHaveBeenCalledWith(
		"primary",
		interview.calendarEventId,
		expect.anything(),
	);
	expect(interview.publishedAt).toBe(Date.now());
});
