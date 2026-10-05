import { ADMISSION_CONSENT } from "@workspace/shared/admissions";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { insertInternalGroup } from "../../../test/admissions-fixtures";
import { allOperations, finishOperation } from "../../../test/admissions-workflow";
import { asUser, grantRole, insertStudent, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { listOperations } from "../delivery/workflow";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
	delete process.env.CONVEX_CLOUD_URL;
	delete process.env.APP_ENV;
});

async function users(t: Awaited<ReturnType<typeof setup>>["t"]) {
	const student = await insertUser(t, "student@uio.no");
	await insertStudent(t, student._id);
	const otherStudent = await insertUser(t, "other@uio.no");
	await insertStudent(t, otherStudent._id);
	const board = await insertUser(t, "board@example.test");
	await grantRole(t, board._id, "internal");
	const secondBoard = await insertUser(t, "second-board@example.test");
	await grantRole(t, secondBoard._id, "internal");
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	return {
		student: asUser(t, student),
		otherStudent: asUser(t, otherStudent),
		board: asUser(t, board),
		admin: asUser(t, admin),
		studentId: student._id,
		boardId: board._id,
		secondBoardId: secondBoard._id,
	};
}

async function openPeriod(
	admin: Awaited<ReturnType<typeof users>>["admin"],
	boardId: Id<"users">,
	secondBoardId: Id<"users">,
) {
	const now = Date.now();
	return await admin.mutation(api.admissions.mutations.createPeriod, {
		title: "Vår 2027",
		applicationStartAt: now - DAY,
		applicationEndAt: now + DAY,
		interviewStartAt: now + 2 * DAY,
		interviewEndAt: now + 9 * DAY,
		retentionAt: now + 20 * DAY,
		interviewers: [
			{ userId: boardId, selectedCalendarIds: [] },
			{ userId: secondBoardId, selectedCalendarIds: [] },
		],
	});
}

async function submitAnswers(
	t: Awaited<ReturnType<typeof setup>>["t"],
	student: ReturnType<typeof asUser>,
	periodId: Id<"admissionPeriods">,
	answers: {
		about: string;
		motivation: string;
		group: string;
		availability: { day: string; start: number; end: number }[];
	},
) {
	const group =
		answers.group === "Usikker ennå" || answers.group === "unsure"
			? "unsure"
			: await insertInternalGroup(t, answers.group);
	await student.mutation(api.admissions.mutations.saveApplication, {
		periodId,
		...answers,
		group,
		expectedRevision: 0,
		submit: true,
		consent: true,
	});
}

async function acceptApplication(
	t: Awaited<ReturnType<typeof setup>>["t"],
	admin: ReturnType<typeof asUser>,
	candidate: { _id: Id<"admissionApplications">; revision: number },
	reviewedWorkspaceEmail: string,
	group = "Bedrift",
) {
	return admin.mutation(api.admissions.mutations.setDecision, {
		applicationId: candidate._id,
		decision: "accepted",
		reviewedGroupId: await insertInternalGroup(t, group),
		reviewedWorkspaceEmail,
		expectedRevision: candidate.revision,
	});
}

it("limits admin data to admins and applicant data to the signed-in student's own application", async () => {
	const { t } = await setup();
	const { student, otherStudent, board, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await expect(board.query(api.admissions.queries.adminOverview, { periodId })).rejects.toThrow(
		/Unauthorized/,
	);
	await expect(student.query(api.admissions.queries.adminOverview, { periodId })).rejects.toThrow(
		/Unauthorized/,
	);
	await expect(
		t.query(api.admissions.queries.applicationContext, { now: Date.now() }),
	).rejects.toThrow(/Unauthorized/);

	const answers = {
		periodId,
		about: "Om meg",
		motivation: "Jeg vil bidra",
		group: await insertInternalGroup(t, "Bedrift"),
		availability: [
			{ day: new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10), start: 540, end: 720 },
		],
	};
	const saved = await student.mutation(api.admissions.mutations.saveApplication, {
		...answers,
		expectedRevision: 0,
		submit: false,
		consent: false,
	});
	await expect(
		otherStudent.query(api.admissions.queries.applicationContext, { now: Date.now() }),
	).resolves.toMatchObject({ application: null });
	await expect(
		otherStudent.mutation(api.admissions.mutations.saveApplication, {
			...answers,
			submit: true,
			periodId,
			expectedRevision: saved.revision,
			consent: true,
		}),
	).rejects.toThrow(/Fant ikke søknaden/);
	await student.mutation(api.admissions.mutations.saveApplication, {
		...answers,
		submit: true,
		periodId,
		expectedRevision: saved.revision,
		consent: true,
	});
	await expect(
		student.query(api.admissions.queries.applicationContext, { now: Date.now() }),
	).resolves.toMatchObject({ application: { about: "Om meg", motivation: "Jeg vil bidra" } });
	await expect(
		student.query(api.admissions.queries.applicationContext, { now: Date.now() }),
	).resolves.toMatchObject({
		period: {
			applicationEndAt: Date.now() + DAY,
			interviewStartAt: Date.now() + 2 * DAY,
			interviewEndAt: Date.now() + 9 * DAY,
			retentionAt: Date.now() + 20 * DAY,
		},
	});
	await expect(
		student.mutation(api.admissions.mutations.saveApplication, {
			...answers,
			submit: true,
			periodId,
			expectedRevision: saved.revision,
			consent: true,
		}),
	).rejects.toThrow(/allerede/);
});

it("saves and submits atomically while rejecting stale edits and missing consent", async () => {
	const { t } = await setup();
	const { student, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	const answers = {
		periodId,
		about: "Original answer",
		motivation: "I want to contribute",
		group: "unsure" as const,
		availability: [],
	};
	const saved = await student.mutation(api.admissions.mutations.saveApplication, {
		...answers,
		expectedRevision: 0,
		submit: false,
		consent: false,
	});
	await expect(
		student.mutation(api.admissions.mutations.saveApplication, {
			...answers,
			about: "Stale answer",
			expectedRevision: 0,
			submit: false,
			consent: false,
		}),
	).rejects.toThrow(/endret/);
	await expect(
		student.mutation(api.admissions.mutations.saveApplication, {
			...answers,
			about: "Unconfirmed answer",
			expectedRevision: saved.revision,
			submit: true,
			consent: false,
		}),
	).rejects.toThrow(/samtykke/);
	const draft = await t.run((ctx) => ctx.db.get(saved.applicationId));
	expect(draft).toMatchObject({ about: answers.about, status: "draft", revision: saved.revision });
	expect(draft?.consentedAt).toBeUndefined();
	const sent = await student.mutation(api.admissions.mutations.saveApplication, {
		...answers,
		about: "Final answer",
		expectedRevision: saved.revision,
		submit: true,
		consent: true,
	});
	expect(await t.run((ctx) => ctx.db.get(saved.applicationId))).toMatchObject({
		about: "Final answer",
		status: "submitted",
		revision: saved.revision + 1,
		consentVersion: ADMISSION_CONSENT.version,
		consentedAt: expect.any(Number),
	});
	expect(sent.applicationId).toBe(saved.applicationId);
});

it("keeps calendar discovery and schedule generation admin-only", async () => {
	process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3212";
	process.env.APP_ENV = "local";
	const { t } = await setup();
	const { student, board, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await expect(
		student.action(api.admissions.interviews.calendar.sources, {
			periodId,
			interviewerId: boardId,
		}),
	).rejects.toThrow(/Unauthorized/);
	await expect(
		board.action(api.admissions.interviews.calendar.sources, { periodId, interviewerId: boardId }),
	).rejects.toThrow(/Unauthorized/);
	await expect(
		student.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 0,
		}),
	).rejects.toThrow(/Unauthorized/);
	await expect(
		board.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 0,
		}),
	).rejects.toThrow(/Unauthorized/);
});

it("validates independent period windows, the 14-day cap, selected interviewers, and scheduling breaks", async () => {
	const { t } = await setup();
	const { student, admin, boardId, secondBoardId } = await users(t);
	const now = Date.now();
	await expect(
		admin.mutation(api.admissions.mutations.createPeriod, {
			title: "Too long",
			applicationStartAt: now,
			applicationEndAt: now + 15 * DAY,
			interviewStartAt: now + 16 * DAY,
			interviewEndAt: now + 31 * DAY,
			retentionAt: now + 180 * DAY,
			interviewers: [
				{ userId: boardId, selectedCalendarIds: [] },
				{ userId: secondBoardId, selectedCalendarIds: [] },
			],
		}),
	).rejects.toThrow(/14 dager/);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await submitAnswers(t, student, periodId, {
		about: "Om meg",
		motivation: "Motivasjon",
		group: "Bedrift",
		availability: [
			{ day: new Date(now + 3 * DAY).toISOString().slice(0, 10), start: 540, end: 720 },
		],
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	const applicationId = overview?.candidates[0]?._id;
	if (!applicationId) throw new Error("Expected submitted candidate");
	await expect(
		admin.mutation(api.admissions.mutations.scheduleInterview, {
			expectedPeriodRevision: 1,
			applicationId,
			startAt: new Date(
				`${new Date(now + 3 * DAY).toISOString().slice(0, 10)}T10:00:00+02:00`,
			).getTime(),
			interviewerIds: [boardId],
			expectedRevision: overview.candidates[0].revision,
		}),
	).rejects.toThrow(/to ulike intervjuere/);
	await expect(
		admin.mutation(api.admissions.mutations.scheduleInterview, {
			expectedPeriodRevision: 1,
			applicationId,
			startAt: new Date(
				`${new Date(now + 3 * DAY).toISOString().slice(0, 10)}T12:15:00+02:00`,
			).getTime(),
			interviewerIds: [boardId, secondBoardId],
			expectedRevision: overview.candidates[0].revision,
		}),
	).rejects.toThrow(/pause/);
});

it("keeps an accepted decision separate from sending and makes send idempotent", async () => {
	const { t } = await setup();
	const { student, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await submitAnswers(t, student, periodId, {
		about: "Om meg",
		motivation: "Motivasjon",
		group: "Bedrift",
		availability: [
			{ day: new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10), start: 540, end: 720 },
		],
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	const candidate = overview?.candidates[0];
	if (!candidate) throw new Error("Expected submitted candidate");
	const decision = await acceptApplication(t, admin, candidate, "new.member@ifinavet.no");
	expect(
		(await admin.query(api.admissions.queries.adminOverview, { periodId }))?.candidates[0]
			?.decisionSentAt,
	).toBeUndefined();
	const key = `send:${candidate._id}:${decision.revision}`;
	await admin.mutation(api.admissions.mutations.sendDecision, {
		applicationId: candidate._id,
		expectedRevision: decision.revision,
		idempotencyKey: key,
	});
	await admin.mutation(api.admissions.mutations.sendDecision, {
		applicationId: candidate._id,
		expectedRevision: decision.revision,
		idempotencyKey: key,
	});
	await expect(t.run((ctx) => allOperations(ctx))).resolves.toHaveLength(1);
});

it("provisions only after an authenticated applicant accepts an offer; decline grants no access", async () => {
	const { t } = await setup();
	const { student, otherStudent, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await submitAnswers(t, student, periodId, {
		about: "Om",
		motivation: "Hvorfor",
		group: "Bedrift",
		availability: [],
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	const candidate = overview?.candidates[0];
	if (!candidate) throw new Error("Expected submitted candidate");
	const decision = await acceptApplication(t, admin, candidate, "student@ifinavet.no");
	await expect(t.run((ctx) => ctx.db.query("memberAccounts").collect())).resolves.toHaveLength(0);
	await admin.mutation(api.admissions.mutations.sendDecision, {
		applicationId: candidate._id,
		expectedRevision: decision.revision,
		idempotencyKey: `offer:${candidate._id}`,
	});
	const pending = (
		await student.query(api.admissions.queries.applicationContext, { now: Date.now() })
	)?.application;
	await expect(
		student.mutation(api.admissions.mutations.respondToOffer, {
			periodId,
			accept: true,
			expectedRevision: pending?.revision ?? 0,
		}),
	).rejects.toThrow(/tilbud/i);
	const firstKey = `offer:${candidate._id}`;

	await finishOperation(t, firstKey);
	await submitAnswers(t, otherStudent, periodId, {
		about: "Om",
		motivation: "Hvorfor",
		group: "Web",
		availability: [],
	});
	const latest = await admin.query(api.admissions.queries.adminOverview, { periodId });
	const second = latest?.candidates.find((item) => item.userId !== candidate.userId);
	if (!second) throw new Error("Expected second candidate");
	const declinedDecision = await acceptApplication(t, admin, second, "other@ifinavet.no", "Web");
	const secondKey = `offer:${second._id}`;
	await admin.mutation(api.admissions.mutations.sendDecision, {
		applicationId: second._id,
		expectedRevision: declinedDecision.revision,
		idempotencyKey: secondKey,
	});

	await finishOperation(t, secondKey);
	const otherPending = (
		await otherStudent.query(api.admissions.queries.applicationContext, { now: Date.now() })
	)?.application;
	await otherStudent.mutation(api.admissions.mutations.respondToOffer, {
		periodId,
		accept: false,
		expectedRevision: otherPending?.revision ?? 0,
	});
	await expect(t.run((ctx) => ctx.db.query("memberAccounts").collect())).resolves.toHaveLength(0);
	await expect(
		t.run((ctx) =>
			listOperations(ctx, periodId).then((jobs) =>
				jobs.filter((job) => job.kind === "offer_declined"),
			),
		),
	).resolves.toHaveLength(1);
	const self = (await student.query(api.admissions.queries.applicationContext, { now: Date.now() }))
		?.application;
	await student.mutation(api.admissions.mutations.respondToOffer, {
		periodId,
		accept: true,
		expectedRevision: self?.revision ?? 0,
	});
	await expect(t.run((ctx) => ctx.db.query("memberAccounts").collect())).resolves.toHaveLength(1);
	await expect(
		student.mutation(api.admissions.mutations.respondToOffer, {
			periodId,
			accept: false,
			expectedRevision:
				(await student.query(api.admissions.queries.applicationContext, { now: Date.now() }))
					?.application?.revision ?? 0,
		}),
	).rejects.toThrow(/allerede/i);
});

it("hides conflicting member identities when accepted-offer onboarding fails", async () => {
	const { t } = await setup();
	const { student, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await submitAnswers(t, student, periodId, {
		about: "Om meg",
		motivation: "Jeg vil bidra",
		group: "Bedrift",
		availability: [],
	});
	const application = (await admin.query(api.admissions.queries.adminOverview, { periodId }))
		?.candidates[0];
	if (!application) throw new Error("Expected submitted candidate");
	const decision = await acceptApplication(t, admin, application, "private-member@ifinavet.no");
	const offerKey = `private-conflict:${application._id}`;
	await admin.mutation(api.admissions.mutations.sendDecision, {
		applicationId: application._id,
		expectedRevision: decision.revision,
		idempotencyKey: offerKey,
	});

	await finishOperation(t, offerKey);
	await t.run((ctx) =>
		ctx.db.insert("memberAccounts", {
			workspaceEmail: "private-member@ifinavet.no",
			uioEmail: "former-member@uio.no",
			firstName: "Privat navn",
			lastName: "Medlem",
			group: "Bedrift",
			stage: "active",
			google: "existing",
			updatedAt: Date.now(),
		}),
	);
	const pending = (
		await student.query(api.admissions.queries.applicationContext, { now: Date.now() })
	)?.application;
	const failure = await student
		.mutation(api.admissions.mutations.respondToOffer, {
			periodId,
			accept: true,
			expectedRevision: pending?.revision ?? 0,
		})
		.catch((error: unknown) => error);
	expect(String(failure)).toContain("Svaret kunne ikke registreres akkurat nå.");
	expect(String(failure)).not.toContain("private-member@ifinavet.no");
	expect(String(failure)).not.toContain("former-member@uio.no");
	expect(String(failure)).not.toContain("Privat navn");
	await expect(
		student.query(api.admissions.queries.applicationContext, { now: Date.now() }),
	).resolves.toMatchObject({ application: { offerStatus: "pending" } });
});

it("allows applicant cancellation and marks refill eligible only when 48 hours remain", async () => {
	const { t } = await setup();
	const { student, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	const day = new Date(Date.now() + 4 * DAY).toISOString().slice(0, 10);
	await submitAnswers(t, student, periodId, {
		about: "Om",
		motivation: "Hvorfor",
		group: "Bedrift",
		availability: [{ day, start: 540, end: 720 }],
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	const candidate = overview?.candidates[0];
	if (!candidate) throw new Error("Expected submitted candidate");
	const startAt = new Date(`${day}T10:00:00+02:00`).getTime();
	const scheduled = await admin.mutation(api.admissions.mutations.scheduleInterview, {
		expectedPeriodRevision: 1,
		applicationId: candidate._id,
		startAt,
		interviewerIds: [boardId, secondBoardId],
		expectedRevision: candidate.revision,
	});
	await t.run(async (ctx) => {
		const interview = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", candidate._id))
			.unique();
		if (!interview) throw new Error("Expected interview");
		await ctx.db.patch(interview._id, {
			startAt: Date.now() + DAY,
			endAt: Date.now() + DAY + 15 * 60 * 1000,
			publishedAt: Date.now(),
		});
	});
	const current = (
		await student.query(api.admissions.queries.applicationContext, { now: Date.now() })
	)?.application;
	const cancelled = await student.mutation(api.admissions.mutations.cancelInterview, {
		applicationId: candidate._id,
		expectedRevision: current?.revision ?? scheduled.revision,
		idempotencyKey: "cancel:one",
	});
	expect(cancelled.refillEligible).toBe(false);
	await expect(
		admin.query(api.admissions.queries.adminOverview, { periodId }),
	).resolves.toMatchObject({ interviews: [] });
});

it("purges sensitive history and applicant identity on close", async () => {
	const { t } = await setup();
	const { student, admin, boardId, secondBoardId } = await users(t);
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	await submitAnswers(t, student, periodId, {
		about: "Private detail",
		motivation: "Private reason",
		group: "Bedrift",
		availability: [],
	});
	const overview = await admin.query(api.admissions.queries.adminOverview, { periodId });
	const candidate = overview?.candidates[0];
	if (!candidate) throw new Error("Expected submitted candidate");
	await admin.mutation(api.admissions.mutations.addNote, {
		applicationId: candidate._id,
		note: "Confidential note",
		expectedRevision: candidate.revision,
	});
	await t.run(async (ctx) => {
		const period = await ctx.db.get(periodId);
		if (!period) throw new Error("Expected period");
		await ctx.db.patch(periodId, { retentionAt: Date.now() - 1 });
	});
	await admin.mutation(api.admissions.mutations.closePeriod, {
		periodId,
		idempotencyKey: "close:test",
	});

	await finishOperation(t, `close-archive:${periodId}`);
	await expect(
		student.query(api.admissions.queries.applicationContext, { now: Date.now() }),
	).resolves.toBeNull();
	await expect(admin.query(api.admissions.queries.adminOverview, { periodId })).resolves.toBeNull();
	await expect(
		t.run((ctx) => ctx.db.query("admissionApplications").collect()),
	).resolves.toHaveLength(0);
	await expect(t.run((ctx) => ctx.db.get(periodId))).resolves.toBeNull();
});

it("returns a safe reactive applicant context across the application lifecycle", async () => {
	const { t } = await setup();
	const now = Date.now();
	const { student, admin, boardId, secondBoardId } = await users(t);
	expect(await student.query(api.admissions.queries.applicationContext, { now })).toBeNull();
	const periodId = await openPeriod(admin, boardId, secondBoardId);
	const period = await t.run((ctx) => ctx.db.get(periodId));
	if (!period) throw new Error("Missing period");
	for (const at of [period.applicationStartAt, period.applicationEndAt]) {
		const result = await student.query(api.admissions.queries.applicationContext, { now: at });
		expect(result).toMatchObject({ period: { _id: periodId }, isOpen: true, application: null });
		expect(result?.period).not.toHaveProperty("interviewers");
		expect(result?.period).not.toHaveProperty("roundHistory");
	}
	for (const at of [period.applicationStartAt - 1, period.applicationEndAt + 1, Number.NaN])
		expect(
			await student.query(api.admissions.queries.applicationContext, { now: at }),
		).toMatchObject({ isOpen: false });
	for (const status of ["draft", "published"] as const) {
		await t.run((ctx) => ctx.db.patch(periodId, { status }));
		expect(await student.query(api.admissions.queries.applicationContext, { now })).toMatchObject({
			isOpen: false,
		});
	}
	await t.run((ctx) => ctx.db.patch(periodId, { status: "closing" }));
	expect(await student.query(api.admissions.queries.applicationContext, { now })).toBeNull();
	await t.run((ctx) => ctx.db.delete(periodId));
	expect(await student.query(api.admissions.queries.applicationContext, { now })).toBeNull();
});
