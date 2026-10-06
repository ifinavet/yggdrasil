import { localWindow } from "@workspace/shared/time";
import { afterEach, expect, it, vi } from "vitest";
import {
	applicationFields,
	firstAdmissionOperation,
	insertInternalGroup,
	insertInterview,
	interviewFields,
	interviewForApplication,
	periodFields,
} from "../../../test/admissions-fixtures";
import {
	finishOperation,
	firstOperation,
	operationArgs,
	operationByKey,
	stageOperation,
} from "../../../test/admissions-workflow";
import {
	asUser,
	grantRole,
	insertStudent,
	insertUser,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { listOperations } from "../delivery/workflow";

const DAY = 86400000;
const MINUTE = 60000;
const TIME_ZONE = "Europe/Oslo";

async function withFixedDate<T>(isoDate: string, run: () => Promise<T>) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(isoDate));
	try {
		return await run();
	} finally {
		vi.useRealTimers();
	}
}

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
	const value = await periodApplicationFixture();
	const { now, periodId, applicationId } = value;
	const day = localWindow(now + 4 * DAY, 0, TIME_ZONE).day;
	const startAt = osloAt(day, hour, minute);
	await value.t.run((ctx) => ctx.db.patch(applicationId, { availability }));
	const scheduleArgs = {
		applicationId,
		startAt,
		interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
		expectedPeriodRevision: 1,
		expectedRevision: 1,
	};
	return { ...value, periodId, applicationId, startAt, day, scheduleArgs };
}

async function setAvailability(
	t: TestBackend,
	applicationId: Id<"admissionApplications">,
	day: string,
) {
	await t.run((ctx) =>
		ctx.db.patch(applicationId, { availability: [{ day, start: 600, end: 620 }] }),
	);
}

async function insertCancelledInterview(value: Awaited<ReturnType<typeof scheduleFixture>>) {
	return await insertInterview(value.t, value.periodId, value.applicationId, {
		startAt: value.startAt,
		endAt: value.startAt + 15 * MINUTE,
		interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
		status: "cancelled",
		revision: 2,
	});
}

async function addInterviewerPair(
	value: Awaited<ReturnType<typeof scheduleFixture>>,
	thirdEmail: string,
	fourthEmail: string,
) {
	const third = await insertUser(value.t, thirdEmail);
	const fourth = await insertUser(value.t, fourthEmail);
	await grantRole(value.t, third._id, "internal");
	await grantRole(value.t, fourth._id, "internal");
	await value.admin.mutation(api.admissions.board.updateSettings, {
		settings: {},
		periodId: value.periodId,
		expectedRevision: 1,
		interviewers: [value.interviewer, value.otherInterviewer, third, fourth].map(({ _id }) => ({
			userId: _id,
			selectedCalendarIds: [],
		})),
	});
	return { third, fourth };
}

async function periodApplicationFixture() {
	const value = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(
		value.admin,
		now - DAY,
		[value.interviewer],
		value.otherInterviewer,
	);
	const applicationId = await value.t.run((ctx) =>
		ctx.db.insert("admissionApplications", applicationFields(periodId, value.applicant._id)),
	);
	return { ...value, now, periodId, applicationId };
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
	const { t, admin, interviewer, otherInterviewer, now, periodId, applicationId } =
		await periodApplicationFixture();
	const interviewId = await insertInterview(t, periodId, applicationId, {
		startAt: now + 5 * DAY,
		endAt: now + 5 * DAY + 15 * 60000,
		interviewerIds: [interviewer._id, otherInterviewer._id],
		revision: 4,
		publishedAt: now,
	});
	await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "published" });
		await stageOperation(ctx, {
			kind: "remind_1d",
			periodId,
			applicationId,
			interviewId,
			revision: 4,
			idempotencyKey: "reminder-current",
			state: "inProgress",
			dueAt: now,
		});
	});

	await admin.mutation(api.admissions.board.updateSettings, {
		periodId,
		expectedRevision: 1,
		settings: { room: "Alfa" },
	});
	await expect(
		t.query(internal.admissions.internal.operationIsCurrent, {
			operation: await operationArgs(t, "reminder-current"),
		}),
	).resolves.toBe(true);
});

it("cleans future and past calendar events on close without sending cancellation mail for past interviews", async () => {
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await createPeriod(admin, now - DAY, [interviewer], otherInterviewer);
	const applicationIds = await t.run(async (ctx) => {
		const ids = [];
		for (const userId of [applicant._id, applicant._id]) {
			ids.push(await ctx.db.insert("admissionApplications", applicationFields(periodId, userId)));
		}
		return ids;
	});
	await t.run(async (ctx) => {
		for (const [index, applicationId] of applicationIds.entries()) {
			const startAt = now + (index === 0 ? DAY : -DAY);
			await ctx.db.insert(
				"admissionInterviews",
				interviewFields(periodId, applicationId, {
					startAt: startAt,
					endAt: startAt + 15 * 60000,
					interviewerIds: [interviewer._id, otherInterviewer._id],
					calendarEventId: `event-${index}`,
					publishedAt: startAt - DAY,
					revision: 2,
				}),
			);
		}
	});
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const cancellations = await t.run((ctx) => listOperations(ctx, periodId));
	expect(cancellations.filter((job) => job.kind === "cancel_interview")).toHaveLength(2);
	const cancellationNotices = cancellations
		.filter((job) => job.kind === "cancel_interview")
		.map((job) => job.notifyApplicant)
		.sort();
	expect(cancellationNotices).toEqual([false, true]);
});

it("closes an in-flight publish with calendar cleanup without notifying the applicant", async () => {
	const { t, admin, interviewer, otherInterviewer, now, periodId, applicationId } =
		await periodApplicationFixture();
	const interviewId = await insertInterview(t, periodId, applicationId, {
		startAt: now + DAY,
		endAt: now + DAY + 15 * MINUTE,
		interviewerIds: [interviewer._id, otherInterviewer._id],
	});
	await t.run((ctx) =>
		stageOperation(ctx, {
			kind: "publish",
			periodId,
			applicationId,
			interviewId,
			revision: 1,
			idempotencyKey: "publish-in-flight-close",
			state: "inProgress",
			dueAt: now + DAY,
		}),
	);
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const cleanup = await t.run((ctx) =>
		operationByKey(ctx, `close:${periodId}:cancel:${interviewId}`),
	);
	expect(cleanup).toMatchObject({ kind: "cancel_interview", notifyApplicant: false });

	await finishOperation(t, cleanup?.idempotencyKey ?? "");
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toBeNull();
	await finishOperation(t, "publish-in-flight-close");
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toMatchObject({
		kind: "archive_channel",
		state: "inProgress",
	});
});

it("retention cleanup cancels an in-flight publish even before an event id is saved", async () => {
	const { t, applicant, interviewer, otherInterviewer } = await fixture();
	const now = Date.now();
	const periodId = await t.run(async (ctx) => {
		const id = await ctx.db.insert(
			"admissionPeriods",
			periodFields(interviewer._id, {
				title: "Retention test",
				applicationStartAt: now - 2 * DAY,
				applicationEndAt: now - DAY,
				interviewStartAt: now - DAY,
				interviewEndAt: now + DAY,
				retentionAt: now - 1,
				status: "published",
				interviewers: [
					{ userId: interviewer._id, selectedCalendarIds: [] },
					{ userId: otherInterviewer._id, selectedCalendarIds: [] },
				],
				timezone: TIME_ZONE,
			}),
		);
		const applicationId = await ctx.db.insert(
			"admissionApplications",
			applicationFields(id, applicant._id),
		);
		const interviewId = await ctx.db.insert(
			"admissionInterviews",
			interviewFields(id, applicationId, {
				startAt: now + DAY,
				endAt: now + DAY + 15 * MINUTE,
				interviewerIds: [interviewer._id, otherInterviewer._id],
			}),
		);
		await stageOperation(ctx, {
			kind: "publish",
			periodId: id,
			applicationId,
			interviewId,
			revision: 1,
			idempotencyKey: "retention-publish-in-flight",
			state: "inProgress",
			dueAt: now,
		});
		return id;
	});
	await t.mutation(internal.admissions.internal.closeExpiredPeriod, { periodId });
	const cleanup = await t.run((ctx) => firstOperation(ctx, periodId, "cancel_interview"));
	expect(cleanup).toMatchObject({ kind: "cancel_interview", notifyApplicant: false });
});

it("archives only after cancellation cleanup and purges only after archive succeeds", async () => {
	const { t, admin, interviewer, otherInterviewer, now, periodId, applicationId } =
		await periodApplicationFixture();
	const interviewId = await insertInterview(t, periodId, applicationId, {
		startAt: now + DAY,
		endAt: now + DAY + 15 * 60000,
		interviewerIds: [interviewer._id, otherInterviewer._id],
		calendarEventId: "event-close-cleanup",
		publishedAt: now,
		revision: 2,
	});
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const cancellationKey = `close:${periodId}:cancel:${interviewId}`;
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();

	await finishOperation(t, cancellationKey);
	const jobs = await t.run((ctx) => listOperations(ctx, periodId));
	const archive = jobs.find((job) => job.kind === "archive_channel");
	expect(archive).toBeDefined();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	if (!archive) throw new Error("Archive job was not queued");

	await finishOperation(t, archive.idempotencyKey);
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
});

it("finds pending cleanup beyond 200 completed workflows and purges in bounded batches", async () => {
	const { t, admin, interviewer, otherInterviewer, now, periodId, applicationId } =
		await periodApplicationFixture();
	const interviewId = await t.run(async (ctx) => {
		for (let index = 0; index < 205; index++)
			await stageOperation(ctx, {
				kind: "publish",
				periodId,
				revision: index,
				idempotencyKey: `finished-history-${index}`,
				state: "success",
				dueAt: now,
			});
		const id = await ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				startAt: now + DAY,
				endAt: now + DAY + 15 * 60000,
				interviewerIds: [interviewer._id, otherInterviewer._id],
				calendarEventId: "event-many-history",
				publishedAt: now,
				revision: 2,
			}),
		);
		return id;
	});
	expect(await t.run((ctx) => listOperations(ctx, periodId, true))).toEqual([]);

	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const cancellationKey = `close:${periodId}:cancel:${interviewId}`;
	const archiveBeforeCancellation = await t.run((ctx) =>
		operationByKey(ctx, `close-archive:${periodId}`),
	);
	expect(archiveBeforeCancellation).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();

	await finishOperation(t, cancellationKey);
	const archive = await t.run((ctx) => operationByKey(ctx, `close-archive:${periodId}`));
	expect(archive?.kind).toBe("archive_channel");
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	if (!archive) throw new Error("Archive job was not queued");

	await finishOperation(t, archive.idempotencyKey);
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
	for (let batch = 0; batch < 5; batch++) {
		if (!(await t.run((ctx) => ctx.db.get(periodId)))) break;
		await t.mutation(internal.admissions.internal.purgeBatch, { periodId });
	}
	expect(await t.run((ctx) => ctx.db.get(periodId))).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(applicationId))).toBeNull();
}, 20_000);

it("waits for retention calendar cleanup before queueing the archive job", async () => {
	const { t, interviewer, otherInterviewer, now, periodId, applicationId } =
		await periodApplicationFixture();
	const interviewId = await insertInterview(t, periodId, applicationId, {
		startAt: now + DAY,
		endAt: now + DAY + 15 * 60000,
		interviewerIds: [interviewer._id, otherInterviewer._id],
		calendarEventId: "event-retention-cleanup",
		publishedAt: now,
		revision: 2,
	});
	await t.mutation(internal.admissions.internal.closeExpiredPeriod, { periodId });
	const archiveKey = `close-archive:${periodId}`;
	const archiveBeforeCancel = await t.run((ctx) => operationByKey(ctx, archiveKey));
	expect(archiveBeforeCancel).toBeNull();
	const cancelJob = await t.run((ctx) => firstOperation(ctx, periodId, "cancel_interview"));
	expect(cancelJob).toMatchObject({ interviewId, state: "inProgress", notifyApplicant: true });
	expect(await t.run((ctx) => ctx.db.get(applicationId))).not.toBeNull();
	if (!cancelJob) throw new Error("Calendar cleanup job was not queued");

	await finishOperation(t, cancelJob.idempotencyKey);
	expect(await t.run((ctx) => operationByKey(ctx, archiveKey))).toMatchObject({
		kind: "archive_channel",
		state: "inProgress",
	});
});

it("requires exactly two interviewers in both manual and generated schedules", async () => {
	const value = await scheduleFixture(10, 0, [{ day: "2026-10-08", start: 590, end: 630 }]);
	const third = await insertUser(value.t, "third@ifinavet.no");
	await grantRole(value.t, third._id, "internal");
	await value.admin.mutation(api.admissions.board.updateSettings, {
		settings: {},
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
			...value.scheduleArgs,
			expectedPeriodRevision: 2,
			interviewerIds: tooMany,
		}),
	).rejects.toThrow(/to ulike intervjuere/);
	await expect(
		value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId: value.periodId,
			expectedRevision: 2,
			assignments: [
				{
					applicationId: value.applicationId,
					startAt: value.startAt,
					interviewerIds: tooMany,
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
			...value.scheduleArgs,
			startAt,
		}),
	).rejects.toThrow(/lunsj/);
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			...value.scheduleArgs,
			startAt: osloAt(day, 12, 30),
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
			...value.scheduleArgs,
			startAt: osloAt(day, 10, 0),
		}),
	).resolves.toMatchObject({ revision: 2 });

	const generated = await scheduleFixture(10, 0, availability);
	await expect(
		generated.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId: generated.periodId,
			expectedRevision: 1,
			assignments: [
				{
					applicationId: generated.applicationId,
					startAt: osloAt(generated.day, 10, 0),
					interviewerIds: [generated.interviewer._id, generated.otherInterviewer._id],
					room: "Beta",
				},
			],
		}),
	).resolves.toMatchObject({ count: 1 });
});

it("requires explicit admin confirmation to manually schedule outside applicant availability", async () => {
	const value = await scheduleFixture(10, 0, []);
	const args = value.scheduleArgs;
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, args),
	).rejects.toThrow(/ikke tilgjengelig/);
	await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
		...args,
		candidateConfirmedOutsideForm: true,
	});
	const interview = await interviewForApplication(value.t, value.applicationId);
	expect(interview?.candidateConfirmedOutsideForm).toBe(true);
});

it("derives manual interview calendars from the period's interviewer selections", async () => {
	const value = await scheduleFixture(10, 0, []);
	await setAvailability(value.t, value.applicationId, value.day);
	await value.admin.mutation(api.admissions.board.updateSettings, {
		settings: {},
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
			expectedPeriodRevision: 1,
		}),
	).rejects.toThrow(/Opptaket er endret/);
	await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
		expectedPeriodRevision: 2,
		...args,
	});
	const interview = await interviewForApplication(value.t, value.applicationId);
	expect(interview?.selectedCalendarIds).toEqual(["primary"]);
});

it("keeps a published interview unchanged during generated replanning", async () => {
	await withFixedDate("2026-01-05T07:00:00.000Z", async () => {
		const value = await scheduleFixture(10, 0, []);
		const nearDay = localWindow(Date.now() + DAY, 0, TIME_ZONE).day;
		const startAt = osloAt(nearDay, 10, 0);
		await setAvailability(value.t, value.applicationId, nearDay);
		const endAt = startAt + 15 * MINUTE;
		await insertInterview(value.t, value.periodId, value.applicationId, {
			startAt: startAt,
			endAt: endAt,
			interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
			calendarEventId: "published-event",
			publishedAt: Date.now(),
			revision: 3,
		});
		await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			...value.scheduleArgs,
			startAt,
		});
		await value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId: value.periodId,
			expectedRevision: 2,
			assignments: [
				{
					applicationId: value.applicationId,
					startAt,
					interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
					room: "Beta",
				},
			],
		});
		const saved = await interviewForApplication(value.t, value.applicationId);
		expect(saved).toMatchObject({
			publishedAt: expect.any(Number),
			calendarEventId: "published-event",
		});
	});
});

it("allows admins to cancel published applicant interviews and preserves notice intent", async () => {
	const value = await scheduleFixture(10, 0, []);
	const interviewId = await insertInterview(value.t, value.periodId, value.applicationId, {
		startAt: value.startAt,
		endAt: value.startAt + 15 * MINUTE,
		interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
		publishedAt: Date.now(),
		revision: 3,
	});
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
		job: await operationByKey(ctx, args.idempotencyKey),
	}));
	expect(result.interview?.status).toBe("cancelled");
	expect(result.job?.notifyApplicant).toBe(true);
});

it("rejects overlapping interviews that use the same room even with different interviewers", async () => {
	const value = await scheduleFixture(10, 0, []);
	const { third, fourth } = await addInterviewerPair(
		value,
		"third@ifinavet.no",
		"fourth@ifinavet.no",
	);
	const secondApplicant = await insertUser(value.t, "candidate2@uio.no");
	await insertStudent(value.t, secondApplicant._id);
	const secondApplicationId = await value.t.run((ctx) =>
		ctx.db.insert(
			"admissionApplications",
			applicationFields(value.periodId, secondApplicant._id, {
				availability: [{ day: value.day, start: 600, end: 620 }],
			}),
		),
	);
	await setAvailability(value.t, value.applicationId, value.day);
	const args = {
		startAt: value.startAt,
		room: "Beta",
	};
	await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
		...args,
		expectedPeriodRevision: 2,
		applicationId: value.applicationId,
		interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
		expectedRevision: 1,
	});
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			...args,
			expectedPeriodRevision: 3,
			applicationId: secondApplicationId,
			interviewerIds: [third._id, fourth._id],
			expectedRevision: 1,
		}),
	).rejects.toThrow(/rom/i);
});

it("rejects generated assignments that double-book a room", async () => {
	const value = await scheduleFixture(10, 0, []);
	const { third, fourth } = await addInterviewerPair(
		value,
		"third-plan@ifinavet.no",
		"fourth-plan@ifinavet.no",
	);
	const secondApplicant = await insertUser(value.t, "candidate-plan2@uio.no");
	await setAvailability(value.t, value.applicationId, value.day);
	const secondApplicationId = await value.t.run((ctx) =>
		ctx.db.insert(
			"admissionApplications",
			applicationFields(value.periodId, secondApplicant._id, {
				availability: [{ day: value.day, start: 600, end: 620 }],
			}),
		),
	);
	const shared = {
		startAt: value.startAt,
		room: "Beta",
	};
	await expect(
		value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId: value.periodId,
			expectedRevision: 2,
			assignments: [
				{
					...shared,
					applicationId: value.applicationId,
					interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
				},
				{
					...shared,
					applicationId: secondApplicationId,
					interviewerIds: [third._id, fourth._id],
				},
			],
		}),
	).rejects.toThrow(/rom/i);
});

it("requires explicit candidate agreement before manually rebooking a cancelled interview", async () => {
	const value = await scheduleFixture(10, 0, []);
	await setAvailability(value.t, value.applicationId, value.day);
	await insertCancelledInterview(value);
	const args = value.scheduleArgs;
	await expect(
		value.admin.mutation(api.admissions.mutations.scheduleInterview, args),
	).rejects.toThrow(/bekreft|avtalt/i);
	await value.admin.mutation(api.admissions.mutations.scheduleInterview, {
		...args,
		candidateConfirmedOutsideForm: true,
	});
	const interview = await interviewForApplication(value.t, value.applicationId);
	expect(interview).toMatchObject({ status: "scheduled", candidateConfirmedOutsideForm: true });
});

it("does not let generated plans resurrect a cancelled interview", async () => {
	const value = await scheduleFixture(10, 0, []);
	await setAvailability(value.t, value.applicationId, value.day);
	await insertCancelledInterview(value);
	await expect(
		value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId: value.periodId,
			expectedRevision: 1,
			assignments: [
				{
					applicationId: value.applicationId,
					startAt: value.startAt,
					interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
					room: "Beta",
				},
			],
		}),
	).rejects.toThrow(/avlyst|cancel/i);
});

it("requires two days of notice for a new manual interview", async () => {
	await withFixedDate("2026-01-05T07:00:00.000Z", async () => {
		const value = await scheduleFixture(10, 0, []);
		const nearDay = localWindow(Date.now() + DAY, 0, TIME_ZONE).day;
		const startAt = osloAt(nearDay, 10, 0);
		await setAvailability(value.t, value.applicationId, nearDay);
		await expect(
			value.admin.mutation(api.admissions.mutations.scheduleInterview, {
				...value.scheduleArgs,
				startAt,
			}),
		).rejects.toThrow(/48|to dager/i);
	});
});

it("requires two days of notice for generated assignments", async () => {
	const value = await scheduleFixture(10, 0, []);
	const nearDay = localWindow(Date.now() + DAY, 0, TIME_ZONE).day;
	const startAt = osloAt(nearDay, 10, 0);
	await setAvailability(value.t, value.applicationId, nearDay);
	await expect(
		value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
			periodId: value.periodId,
			expectedRevision: 1,
			assignments: [
				{
					applicationId: value.applicationId,
					startAt,
					interviewerIds: [value.interviewer._id, value.otherInterviewer._id],
					room: "Beta",
				},
			],
		}),
	).rejects.toThrow(/48|to dager/i);
});

it("rejects invalid reviewed account details before sending an accepted offer", async () => {
	process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL = "admin@ifinavet.no";
	const { t, admin, applicant, interviewer, otherInterviewer } = await fixture();
	const periodId = await createPeriod(admin, Date.now() - DAY, [interviewer], otherInterviewer);
	const reviewedGroupId = await insertInternalGroup(t, "Bedrift");
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", applicationFields(periodId, applicant._id)),
	);
	await expect(
		admin.mutation(api.admissions.mutations.setDecision, {
			applicationId,
			decision: "accepted",
			reviewedGroupId,
			reviewedWorkspaceEmail: "candidate@wrong-domain.example",
			expectedRevision: 1,
		}),
	).rejects.toThrow();
});

it("persists expired offer status instead of rolling it back when a candidate responds late", async () => {
	const value = await fixture();
	const periodId = await createPeriod(
		value.admin,
		Date.now() - DAY,
		[value.interviewer],
		value.otherInterviewer,
	);
	const now = Date.now();
	const applicationId = await value.t.run((ctx) =>
		ctx.db.insert(
			"admissionApplications",
			applicationFields(periodId, value.applicant._id, {
				decisionRevision: 2,
				decision: "accepted",
				decisionSentAt: now - DAY,
				offerStatus: "pending",
				offerDeadline: now - 1,
			}),
		),
	);
	await expect(
		asUser(value.t, value.applicant).mutation(api.admissions.mutations.respondToOffer, {
			periodId,
			accept: true,
			expectedRevision: 1,
		}),
	).resolves.toMatchObject({ offerStatus: "expired", revision: 2 });
	expect(await value.t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({
		offerStatus: "expired",
	});
	await value.admin.mutation(api.admissions.mutations.setDecision, {
		applicationId,
		decision: "rejected",
		expectedRevision: 2,
	});
	expect(await value.t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({
		decision: "rejected",
		offerStatus: "none",
	});
});

it("schedules offer expiration when an accepted decision email is delivered", async () => {
	vi.useFakeTimers();
	try {
		const now = Date.now();
		vi.setSystemTime(now);
		const value = await fixture();
		const periodId = await value.t.run((ctx) =>
			ctx.db.insert(
				"admissionPeriods",
				periodFields(value.adminId, {
					title: "Offer expiry test",
					applicationStartAt: now - 2 * DAY,
					applicationEndAt: now - DAY,
					interviewStartAt: now - DAY,
					interviewEndAt: now + DAY,
					retentionAt: now + 1_000,
					interviewers: [
						{ userId: value.interviewer._id, selectedCalendarIds: [] },
						{ userId: value.otherInterviewer._id, selectedCalendarIds: [] },
					],
					timezone: TIME_ZONE,
				}),
			),
		);
		const applicationId = await value.t.run((ctx) =>
			ctx.db.insert(
				"admissionApplications",
				applicationFields(periodId, value.applicant._id, {
					decisionRevision: 3,
					decision: "accepted",
					decisionQueuedAt: now,
				}),
			),
		);
		await value.t.run((ctx) =>
			stageOperation(ctx, {
				kind: "send_decision",
				periodId,
				applicationId,
				revision: 3,
				idempotencyKey: "decision-expiry-test",
				state: "inProgress",
				dueAt: now,
			}),
		);

		await finishOperation(value.t, "decision-expiry-test");
		expect(await value.t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({
			offerStatus: "pending",
			offerDeadline: now + 1_000,
		});
		await value.t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await value.t.run((ctx) => ctx.db.get(applicationId))).toMatchObject({
			offerStatus: "expired",
		});
	} finally {
		vi.useRealTimers();
	}
});

it("cleans a failed calendar publish before archiving even without a saved event id", async () => {
	const { t, admin, interviewer, otherInterviewer, now, periodId, applicationId } =
		await periodApplicationFixture();
	const interviewId = await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "published" });
		const id = await ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				startAt: now + DAY,
				endAt: now + DAY + 15 * MINUTE,
				interviewerIds: [interviewer._id, otherInterviewer._id],
			}),
		);
		await stageOperation(ctx, {
			kind: "publish",
			periodId,
			applicationId,
			interviewId: id,
			revision: 1,
			idempotencyKey: "publish-failed-before-recording",
			dueAt: now,
			state: "failed",
		});
		return id;
	});
	const interview = await t.run((ctx) => ctx.db.get(interviewId));
	expect(interview?.calendarEventId).toBeUndefined();
	expect(interview?.publishedAt).toBeUndefined();
	expect(
		await t.run((ctx) => operationByKey(ctx, "publish-failed-before-recording")),
	).toMatchObject({ state: "failed" });
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		force: true,
	});
	const cleanup = await t.run((ctx) =>
		operationByKey(ctx, `close:${periodId}:cancel:${interviewId}`),
	);
	expect(cleanup).toMatchObject({
		kind: "cancel_interview",
		interviewId,
		notifyApplicant: false,
		state: "inProgress",
	});
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toBeNull();
	expect(await t.run((ctx) => ctx.db.get(interviewId))).not.toBeNull();
	await finishOperation(t, `close:${periodId}:cancel:${interviewId}`);
	expect(await firstAdmissionOperation(t, periodId, "archive_channel")).toMatchObject({
		state: "inProgress",
	});
});

async function saveScheduleProposal(
	value: Awaited<ReturnType<typeof scheduleFixture>>,
	trigger: "manual" | "generated",
	expectedPeriodRevision = 1,
) {
	if (trigger === "manual")
		return value.admin.mutation(api.admissions.mutations.scheduleInterview, {
			...value.scheduleArgs,
			expectedPeriodRevision,
		});
	return value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
		periodId: value.periodId,
		expectedRevision: expectedPeriodRevision,
		assignments: [
			{
				applicationId: value.applicationId,
				startAt: value.startAt,
				interviewerIds: value.scheduleArgs.interviewerIds,
				room: "Beta",
			},
		],
	});
}

it.each(["manual", "generated"] as const)(
	"%s scheduling preserves omitted drafts and rejects their conflicts",
	async (trigger) => {
		const value = await scheduleFixture(10, 0, []);
		await setAvailability(value.t, value.applicationId, value.day);
		const other = await insertUser(value.t, "omitted@uio.no");
		const otherId = await value.t.run((ctx) =>
			ctx.db.insert("admissionApplications", applicationFields(value.periodId, other._id)),
		);
		const interviewId = await insertInterview(value.t, value.periodId, otherId, {
			startAt: value.startAt,
			endAt: value.startAt + 15 * MINUTE,
			interviewerIds: value.scheduleArgs.interviewerIds,
		});
		const before = await value.t.run((ctx) => ctx.db.get(interviewId));
		await expect(saveScheduleProposal(value, trigger)).rejects.toThrow(/allerede opptatt/);
		expect(await value.t.run((ctx) => ctx.db.get(interviewId))).toEqual(before);
		expect(await interviewForApplication(value.t, value.applicationId)).toBeNull();
	},
);

it.each(["manual", "generated"] as const)(
	"%s scheduling rejects stale calendar selections even for unchanged interviews",
	async (trigger) => {
		const value = await scheduleFixture(10, 0, []);
		await value.t.run((ctx) =>
			ctx.db.patch(value.periodId, {
				revision: 2,
				interviewers: value.scheduleArgs.interviewerIds.map((userId) => ({
					userId,
					selectedCalendarIds: ["primary"],
				})),
			}),
		);
		const interviewId = await insertInterview(value.t, value.periodId, value.applicationId, {
			startAt: value.startAt,
			endAt: value.startAt + 15 * MINUTE,
			interviewerIds: value.scheduleArgs.interviewerIds,
			selectedCalendarIds: ["old-calendar"],
		});
		const before = await value.t.run((ctx) => ctx.db.get(interviewId));
		await expect(saveScheduleProposal(value, trigger)).rejects.toThrow(/Opptaket er endret/);
		expect(await value.t.run((ctx) => ctx.db.get(interviewId))).toEqual(before);
	},
);

it.each([
	["manual", "published"],
	["generated", "published"],
	["manual", "publishing"],
	["generated", "publishing"],
] as const)(
	"%s scheduling leaves unchanged %s interviews and applications intact",
	async (trigger, state) => {
		const value = await scheduleFixture(10, 0, []);
		const interviewId = await insertInterview(value.t, value.periodId, value.applicationId, {
			startAt: value.startAt,
			endAt: value.startAt + 15 * MINUTE,
			interviewerIds: value.scheduleArgs.interviewerIds,
			calendarEventId: "stable-event",
			publishedAt: state === "published" ? Date.now() : undefined,
			revision: 3,
		});
		await value.t.run(async (ctx) => {
			await ctx.db.patch(value.periodId, { status: "published" });
			if (state === "publishing")
				await stageOperation(ctx, {
					kind: "publish",
					periodId: value.periodId,
					applicationId: value.applicationId,
					interviewId,
					revision: 3,
					idempotencyKey: `publish:${interviewId}:3`,
					state: "inProgress",
					dueAt: Date.now() + DAY,
				});
		});
		const before = await value.t.run(async (ctx) => ({
			interview: await ctx.db.get(interviewId),
			application: await ctx.db.get(value.applicationId),
		}));
		await saveScheduleProposal(value, trigger);
		const after = await value.t.run(async (ctx) => ({
			interview: await ctx.db.get(interviewId),
			application: await ctx.db.get(value.applicationId),
		}));
		expect(after).toEqual(before);
		expect(await value.t.run((ctx) => ctx.db.get(value.periodId))).toMatchObject({
			status: "published",
			revision: 2,
		});
	},
);

it.each(["manual", "generated"] as const)(
	"%s scheduling derives duration and calendars from the current period",
	async (trigger) => {
		const value = await scheduleFixture(10, 0, []);
		await value.t.run((ctx) =>
			ctx.db.patch(value.applicationId, {
				availability: [{ day: value.day, start: 600, end: 660 }],
			}),
		);
		await value.admin.mutation(api.admissions.board.updateSettings, {
			periodId: value.periodId,
			expectedRevision: 1,
			settings: { duration: 30 },
			interviewers: value.scheduleArgs.interviewerIds.map((userId) => ({
				userId,
				selectedCalendarIds: ["primary"],
			})),
		});
		await expect(saveScheduleProposal(value, trigger)).rejects.toThrow(/Opptaket er endret/);
		expect(await interviewForApplication(value.t, value.applicationId)).toBeNull();
		await saveScheduleProposal(value, trigger, 2);
		expect(await interviewForApplication(value.t, value.applicationId)).toMatchObject({
			startAt: value.startAt,
			endAt: value.startAt + 30 * MINUTE,
			selectedCalendarIds: ["primary"],
		});
	},
);

it.each([
	["manual", "endAt"],
	["generated", "endAt"],
	["manual", "selectedCalendarIds"],
	["generated", "selectedCalendarIds"],
] as const)("%s scheduling rejects client-supplied %s", async (trigger, field) => {
	const value = await scheduleFixture(10, 0, []);
	const assignment = {
		applicationId: value.applicationId,
		startAt: value.startAt,
		interviewerIds: value.scheduleArgs.interviewerIds,
		room: "Beta",
		[field]: field === "endAt" ? value.startAt + MINUTE : ["unselected-calendar"],
	};
	const attempt =
		trigger === "manual"
			? value.admin.mutation(api.admissions.mutations.scheduleInterview, {
					...assignment,
					expectedRevision: 1,
					expectedPeriodRevision: 1,
				})
			: value.t.mutation(internal.admissions.interviews.schedule.saveSchedule, {
					periodId: value.periodId,
					expectedRevision: 1,
					assignments: [assignment],
				});
	await expect(attempt).rejects.toThrow(/Unexpected field/);
	expect(await interviewForApplication(value.t, value.applicationId)).toBeNull();
});
