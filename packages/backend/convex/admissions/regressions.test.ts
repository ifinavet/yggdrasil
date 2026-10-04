import { localWindow } from "@workspace/shared/admissions";
import { afterEach, expect, it } from "vitest";
import { asUser, grantRole, insertStudent, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

const DAY = 86400000;
const MINUTE = 60000;
const TIME_ZONE = "Europe/Oslo";

function osloAt(day: string, hour: number, minute: number) {
	const utcNoon = Date.parse(`${day}T12:00:00Z`);
	const localNoon = localWindow(utcNoon, 0, TIME_ZONE).start;
	const offset = localNoon - 12 * 60;
	return utcNoon + (hour * 60 + minute - 12 * 60 - offset) * MINUTE;
}

async function scheduleFixture(
	hour: number,
	minute: number,
	availability: { day: string; start: number; end: number }[],
) {
	const value = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(
		value.admin,
		now - DAY,
		[value.interviewer],
		value.otherInterviewer,
	);
	const day = localWindow(now + 4 * DAY, 0, TIME_ZONE).day;
	const startAt = osloAt(day, hour, minute);
	const applicationId = await value.t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: value.applicant._id,
			availability,
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	return { ...value, periodId, applicationId, startAt, day };
}

afterEach(() => {
	delete process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;
});

async function fixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@ifinavet.no");
	await grantRole(t, admin._id, "admin");
	const applicant = await insertUser(t, "candidate@uio.no");
	await insertStudent(t, applicant._id);
	const interviewer = await insertUser(t, "interviewer@ifinavet.no");
	await grantRole(t, interviewer._id, "internal");
	const otherInterviewer = await insertUser(t, "other@ifinavet.no");
	await grantRole(t, otherInterviewer._id, "internal");
	return {
		t,
		admin: asUser(t, admin),
		adminId: admin._id,
		applicant,
		interviewer,
		otherInterviewer,
	};
}

async function createPeriod(
	admin: Awaited<ReturnType<typeof fixture>>["admin"],
	start: number,
	interviewers: Awaited<ReturnType<typeof fixture>>["interviewer"][],
	otherInterviewer: Awaited<ReturnType<typeof fixture>>["otherInterviewer"],
) {
	return await admin.mutation(api.admissions.mutations.createPeriod, {
		title: "Vår 2027",
		applicationStartAt: start,
		applicationEndAt: start + DAY,
		interviewStartAt: start + 2 * DAY,
		interviewEndAt: start + 9 * DAY,
		retentionAt: start + 20 * DAY,
		interviewers: [
			{ userId: interviewers[0]?._id ?? otherInterviewer._id, selectedCalendarIds: [] },
			{ userId: otherInterviewer._id, selectedCalendarIds: [] },
		],
	});
}

it("opens a future period when its application window starts", async () => {
	const { admin, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now + DAY, [interviewer], otherInterviewer);
	expect(await admin.query(api.admissions.queries.adminOverview, { periodId })).toMatchObject({
		period: { _id: periodId, status: "open" },
	});
});

it("keeps a published interview reminder current after unrelated period settings change", async () => {
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now - DAY, [interviewer], otherInterviewer);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	const interviewId = await t.run((ctx) =>
		ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId,
			startAt: now + 5 * DAY,
			endAt: now + 5 * DAY + 15 * 60000,
			interviewerIds: [interviewer._id, otherInterviewer._id],
			selectedCalendarIds: [],
			room: "Beta",
			status: "scheduled",
			revision: 4,
			publishedAt: now,
		}),
	);
	await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "published" });
		await ctx.db.insert("admissionOutbox", {
			kind: "remind_1d",
			periodId,
			applicationId,
			interviewId,
			revision: 4,
			idempotencyKey: "reminder-current",
			state: "pending",
			attempts: 0,
			nextAttemptAt: now,
			createdAt: now,
		});
	});
	await t.mutation(internal.admissions.internal.claimOutbox, {
		idempotencyKey: "reminder-current",
	});
	await admin.mutation(api.admissions.board.updateSettings, {
		periodId,
		expectedRevision: 1,
		settings: { room: "Alfa" },
	});
	await expect(
		t.query(internal.admissions.internal.outboxIsCurrent, { idempotencyKey: "reminder-current" }),
	).resolves.toBe(true);
});

it("cleans future and past calendar events on close without sending cancellation mail for past interviews", async () => {
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now - DAY, [interviewer], otherInterviewer);
	const applicationIds = await t.run(async (ctx) => {
		const ids = [];
		for (const userId of [applicant._id, applicant._id]) {
			ids.push(
				await ctx.db.insert("admissionApplications", {
					periodId,
					userId,
					availability: [],
					status: "submitted",
					revision: 1,
					decisionRevision: 0,
					decision: "pending",
					offerStatus: "none",
					sent: false,
				}),
			);
		}
		return ids;
	});
	await t.run(async (ctx) => {
		for (const [index, applicationId] of applicationIds.entries()) {
			const startAt = now + (index === 0 ? DAY : -DAY);
			await ctx.db.insert("admissionInterviews", {
				periodId,
				applicationId,
				startAt,
				endAt: startAt + 15 * 60000,
				interviewerIds: [interviewer._id, otherInterviewer._id],
				selectedCalendarIds: [],
				room: "Beta",
				calendarEventId: `event-${index}`,
				publishedAt: startAt - DAY,
				status: "scheduled",
				revision: 2,
			});
		}
	});
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		idempotencyKey: "close-regression",
		force: true,
	});
	const cancellations = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId", (q) => q.eq("periodId", periodId))
			.collect(),
	);
	expect(cancellations.filter((job) => job.kind === "cancel_interview")).toHaveLength(2);
});

it("archives only after cancellation cleanup and purges only after archive succeeds", async () => {
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now - DAY, [interviewer], otherInterviewer);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	const interviewId = await t.run((ctx) =>
		ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId,
			startAt: now + DAY,
			endAt: now + DAY + 15 * 60000,
			interviewerIds: [interviewer._id, otherInterviewer._id],
			selectedCalendarIds: [],
			room: "Beta",
			calendarEventId: "event-close-cleanup",
			publishedAt: now,
			status: "scheduled",
			revision: 2,
		}),
	);
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		idempotencyKey: "close-after-cancel",
		force: true,
	});
	const cancellationKey = `close-after-cancel:cancel:${interviewId}`;
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	await t.mutation(internal.admissions.internal.claimOutbox, { idempotencyKey: cancellationKey });
	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: cancellationKey,
	});
	const jobs = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId", (q) => q.eq("periodId", periodId))
			.collect(),
	);
	const archive = jobs.find((job) => job.kind === "archive_channel");
	expect(archive).toBeDefined();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	if (!archive) throw new Error("Archive job was not queued");
	await t.mutation(internal.admissions.internal.claimOutbox, {
		idempotencyKey: archive.idempotencyKey,
	});
	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: archive.idempotencyKey,
	});
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("finds pending cleanup beyond 200 completed outbox rows and purges in bounded batches", async () => {
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now - DAY, [interviewer], otherInterviewer);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	const interviewId = await t.run(async (ctx) => {
		for (let index = 0; index < 205; index++)
			await ctx.db.insert("admissionOutbox", {
				kind: "publish",
				periodId,
				revision: index,
				idempotencyKey: `finished-history-${index}`,
				state: "done",
				attempts: 1,
				nextAttemptAt: now,
				createdAt: now + index,
			});
		const id = await ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId,
			startAt: now + DAY,
			endAt: now + DAY + 15 * 60000,
			interviewerIds: [interviewer._id, otherInterviewer._id],
			selectedCalendarIds: [],
			room: "Beta",
			calendarEventId: "event-many-history",
			publishedAt: now,
			status: "scheduled",
			revision: 2,
		});
		return id;
	});
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		idempotencyKey: "close-many-history",
		force: true,
	});
	const cancellationKey = `close-many-history:cancel:${interviewId}`;
	const archiveBeforeCancellation = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", `close-archive:${periodId}`))
			.unique(),
	);
	expect(archiveBeforeCancellation).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	await t.mutation(internal.admissions.internal.claimOutbox, { idempotencyKey: cancellationKey });
	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: cancellationKey,
	});
	const archive = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", `close-archive:${periodId}`))
			.unique(),
	);
	expect(archive?.kind).toBe("archive_channel");
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	if (!archive) throw new Error("Archive job was not queued");
	await t.mutation(internal.admissions.internal.claimOutbox, {
		idempotencyKey: archive.idempotencyKey,
	});
	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: archive.idempotencyKey,
	});
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
	for (let batch = 0; batch < 5; batch++) {
		if (!(await t.run((ctx) => ctx.db.get(periodId)))) break;
		await t.mutation(internal.admissions.internal.purgeBatch, { periodId });
	}
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("waits for retention calendar cleanup before queueing the archive job", async () => {
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now - DAY, [interviewer], otherInterviewer);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	const interviewId = await t.run((ctx) =>
		ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId,
			startAt: now + DAY,
			endAt: now + DAY + 15 * 60000,
			interviewerIds: [interviewer._id, otherInterviewer._id],
			selectedCalendarIds: [],
			room: "Beta",
			calendarEventId: "event-retention-cleanup",
			publishedAt: now,
			status: "scheduled",
			revision: 2,
		}),
	);
	await t.mutation(internal.admissions.internal.closeExpiredPeriod, { periodId });
	const archiveKey = `close-archive:${periodId}`;
	const archiveBeforeCancel = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", archiveKey))
			.unique(),
	);
	expect(archiveBeforeCancel).toBeNull();
	const cancelJob = await t.run((ctx) =>
		ctx.db
			.query("admissionOutbox")
			.withIndex("by_periodId_and_kind", (q) =>
				q.eq("periodId", periodId).eq("kind", "cancel_interview"),
			)
			.first(),
	);
	expect(cancelJob).toMatchObject({ interviewId, state: "pending" });
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	if (!cancelJob) throw new Error("Calendar cleanup job was not queued");
	await t.mutation(internal.admissions.internal.claimOutbox, {
		idempotencyKey: cancelJob.idempotencyKey,
	});
	await t.mutation(internal.admissions.internal.completeOutbox, {
		idempotencyKey: cancelJob.idempotencyKey,
	});
	expect(
		await t.run((ctx) =>
			ctx.db
				.query("admissionOutbox")
				.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", archiveKey))
				.unique(),
		),
	).toMatchObject({ kind: "archive_channel", state: "pending" });
});

it("requires exactly two interviewers in both manual and generated schedules", async () => {
	const value = await scheduleFixture(10, 0, [{ day: "2026-10-08", start: 590, end: 630 }]);
	const third = await insertUser(value.t, "third@ifinavet.no");
	await grantRole(value.t, third._id, "internal");
	await value.admin.mutation(api.admissions.board.updateInterviewers, {
		periodId: value.periodId,
		expectedRevision: 1,
		interviewers: [
			{ userId: value.interviewer._id, selectedCalendarIds: [] },
			{ userId: value.otherInterviewer._id, selectedCalendarIds: [] },
			{ userId: third._id, selectedCalendarIds: [] },
		],
	});
	const tooMany = [value.interviewer._id, value.otherInterviewer._id, third._id];
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			applicationId: value.applicationId,
			startAt: value.startAt,
			interviewerIds: tooMany,
			selectedCalendarIds: [],
			expectedRevision: 1,
		}),
	).rejects.toThrow(/to intervjuere/);
	await expect(
		value.t.mutation(internal.admissions.internal.saveSchedule, {
			periodId: value.periodId,
			expectedRevision: 2,
			assignments: [
				{
					applicationId: value.applicationId,
					startAt: value.startAt,
					endAt: value.startAt + 15 * MINUTE,
					interviewerIds: tooMany,
					selectedCalendarIds: [],
					room: "Beta",
				},
			],
		}),
	).rejects.toThrow(/to ulike intervjuere/);
});

it("uses the same 12:00 to 12:30 lunch block as the shared scheduler", async () => {
	const value = await scheduleFixture(12, 15, []);
	const day = value.day;
	const startAt = osloAt(day, 12, 15);
	const availability = [
		{ day, start: 735, end: 750 },
		{ day, start: 750, end: 770 },
	];
	await value.t.run((ctx) => ctx.db.patch(value.applicationId, { availability }));
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			applicationId: value.applicationId,
			startAt,
			interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
			selectedCalendarIds: [],
			expectedRevision: 1,
		}),
	).rejects.toThrow(/lunsj/);
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			applicationId: value.applicationId,
			startAt: osloAt(day, 12, 30),
			interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
			selectedCalendarIds: [],
			expectedRevision: 1,
		}),
	).resolves.toMatchObject({ revision: 2 });
});

it("covers applicant availability across adjacent windows in manual and generated schedules", async () => {
	const value = await scheduleFixture(10, 0, []);
	const day = value.day;
	const availability = [
		{ day, start: 600, end: 605 },
		{ day, start: 605, end: 620 },
	];
	await value.t.run((ctx) => ctx.db.patch(value.applicationId, { availability }));
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			applicationId: value.applicationId,
			startAt: osloAt(day, 10, 0),
			interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
			selectedCalendarIds: [],
			expectedRevision: 1,
		}),
	).resolves.toMatchObject({ revision: 2 });

	const generated = await scheduleFixture(10, 0, availability);
	await expect(
		generated.t.mutation(internal.admissions.internal.saveSchedule, {
			periodId: generated.periodId,
			expectedRevision: 1,
			assignments: [
				{
					applicationId: generated.applicationId,
					startAt: osloAt(generated.day, 10, 0),
					endAt: osloAt(generated.day, 10, 15),
					interviewerIds: [generated.interviewer._id, generated.otherInterviewer._id],
					selectedCalendarIds: [],
					room: "Beta",
				},
			],
		}),
	).resolves.toMatchObject({ count: 1 });
});

it("requires explicit admin confirmation to manually schedule outside applicant availability", async () => {
	const value = await scheduleFixture(10, 0, []);
	const args = {
		applicationId: value.applicationId,
		startAt: value.startAt,
		interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
		selectedCalendarIds: [],
		expectedRevision: 1,
	};
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, args),
	).rejects.toThrow(/ikke tilgjengelig/);
	await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
		...args,
		candidateConfirmedOutsideForm: true,
	});
	const interview = await value.t.run((ctx) =>
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", value.applicationId))
			.unique(),
	);
	expect(interview?.candidateConfirmedOutsideForm).toBe(true);
});

it("derives manual interview calendars from the period's interviewer selections", async () => {
	const value = await scheduleFixture(10, 0, []);
	await value.t.run((ctx) =>
		ctx.db.patch(value.applicationId, {
			availability: [{ day: value.day, start: 600, end: 620 }],
		}),
	);
	await value.admin.mutation(api.admissions.board.updateInterviewers, {
		periodId: value.periodId,
		expectedRevision: 1,
		interviewers: [
			{ userId: value.interviewer._id, selectedCalendarIds: ["primary"] },
			{ userId: value.otherInterviewer._id, selectedCalendarIds: ["primary"] },
		],
	});
	const args = {
		applicationId: value.applicationId,
		startAt: value.startAt,
		interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
		expectedRevision: 1,
	};
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			...args,
			selectedCalendarIds: ["unselected-calendar"],
		}),
	).rejects.toThrow(/periodens oppsett/);
	await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
		...args,
		selectedCalendarIds: ["primary"],
	});
	const interview = await value.t.run((ctx) =>
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", value.applicationId))
			.unique(),
	);
	expect(interview?.selectedCalendarIds).toEqual(["primary"]);
});

it("keeps a published interview unchanged during generated replanning", async () => {
	const value = await scheduleFixture(10, 0, []);
	await value.t.run((ctx) =>
		ctx.db.patch(value.applicationId, {
			availability: [{ day: value.day, start: 600, end: 620 }],
		}),
	);
	const endAt = value.startAt + 15 * MINUTE;
	await value.t.run((ctx) =>
		ctx.db.insert("admissionInterviews", {
			periodId: value.periodId,
			applicationId: value.applicationId,
			startAt: value.startAt,
			endAt,
			interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
			selectedCalendarIds: [],
			room: "Beta",
			calendarEventId: "published-event",
			publishedAt: Date.now(),
			status: "scheduled",
			revision: 3,
		}),
	);
	await value.t.mutation(internal.admissions.internal.saveSchedule, {
		periodId: value.periodId,
		expectedRevision: 1,
		assignments: [
			{
				applicationId: value.applicationId,
				startAt: value.startAt,
				endAt,
				interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
				selectedCalendarIds: [],
				room: "Beta",
			},
		],
	});
	const saved = await value.t.run((ctx) =>
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", value.applicationId))
			.unique(),
	);
	expect(saved).toMatchObject({
		publishedAt: expect.any(Number),
		calendarEventId: "published-event",
	});
});

it("allows admins to cancel published applicant interviews and preserves notice intent", async () => {
	const value = await scheduleFixture(10, 0, []);
	const interviewId = await value.t.run((ctx) =>
		ctx.db.insert("admissionInterviews", {
			periodId: value.periodId,
			applicationId: value.applicationId,
			startAt: value.startAt,
			endAt: value.startAt + 15 * MINUTE,
			interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
			selectedCalendarIds: [],
			room: "Beta",
			publishedAt: Date.now(),
			status: "scheduled",
			revision: 3,
		}),
	);
	const args = {
		applicationId: value.applicationId,
		expectedRevision: 1,
		idempotencyKey: "board-cancel-test",
	};
	await expect(
		value.t.mutation(api.admissions.mutations.cancelInterviewByBoard, args),
	).rejects.toThrow();
	await value.admin.mutation(api.admissions.mutations.cancelInterviewByBoard, args);
	const result = await value.t.run(async (ctx) => ({
		interview: await ctx.db.get(interviewId),
		job: await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
			.unique(),
	}));
	expect(result.interview?.status).toBe("cancelled");
	expect(result.job?.notifyApplicant).toBe(true);
});

it("rejects invalid reviewed account details before sending an accepted offer", async () => {
	process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL = "admin@ifinavet.no";
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const periodId = await createPeriod(admin, Date.now() - DAY, [interviewer], otherInterviewer);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicant._id,
			availability: [],
			status: "submitted",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	await expect(
		admin.mutation(api.admissions.mutations.setDecision, {
			applicationId,
			decision: "accepted",
			reviewedGroup: "Bedrift",
			reviewedWorkspaceEmail: "candidate@wrong-domain.example",
			expectedRevision: 1,
		}),
	).rejects.toThrow();
});
