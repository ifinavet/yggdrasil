import { expect, it } from "vitest";
import {
	admissionPeriodFixture,
	applicationFields,
	interviewFields,
} from "../../../test/admissions-fixtures";
import {
	allOperations,
	finishOperation,
	firstOperation,
	stageOperation,
} from "../../../test/admissions-workflow";
import { asUser, grantRole, insertUser } from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";

async function boardFixture() {
	const { t, admin, periodId, now } = await admissionPeriodFixture({ revision: 0 });
	const student = await insertUser(t, "applicant@uio.no");
	const ids = await t.run(async (ctx) => {
		const result = [];
		for (const decision of ["pending", "shortlist", "accepted"] as const) {
			result.push(
				await ctx.db.insert(
					"admissionApplications",
					applicationFields(periodId, student._id, {
						revision: 0,
						decision: decision,
					}),
				),
			);
		}
		return result;
	});
	return { t, admin, student, periodId, ids, now };
}

it("requires admin and a current revision for valid settings changes", async () => {
	const { t, admin, student, periodId } = await boardFixture();
	const update = { periodId, expectedRevision: 0, settings: { duration: 30 } };
	await expect(
		asUser(t, student).mutation(api.admissions.board.updateSettings, update),
	).rejects.toThrow();
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateSettings, {
			...update,
			settings: { duration: -1 },
		}),
	).rejects.toThrow();
	await asUser(t, admin).mutation(api.admissions.board.updateSettings, update);
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateSettings, update),
	).rejects.toThrow();
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({ duration: 30, revision: 1 });
});

it("commits team and settings atomically once and ignores an unchanged resave", async () => {
	const { t, admin, periodId } = await boardFixture();
	const helper = await insertUser(t, "atomic-helper@ifinavet.no");
	await grantRole(t, helper._id, "internal");
	const interviewers = [
		{ userId: admin._id, selectedCalendarIds: ["primary"] },
		{ userId: helper._id, selectedCalendarIds: ["primary"] },
	];
	const args = { periodId, expectedRevision: 0, settings: { duration: 30 }, interviewers };
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateSettings, {
			...args,
			settings: { duration: -1 },
		}),
	).rejects.toThrow();
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({ revision: 0, duration: 15 });
	expect(await t.run((ctx) => allOperations(ctx))).toHaveLength(0);
	await asUser(t, admin).mutation(api.admissions.board.updateSettings, args);
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({
		revision: 1,
		duration: 30,
		interviewers,
	});
	expect(await t.run((ctx) => allOperations(ctx))).toHaveLength(1);
	await asUser(t, admin).mutation(api.admissions.board.updateSettings, {
		...args,
		expectedRevision: 1,
	});
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({ revision: 1 });
	expect(await t.run((ctx) => allOperations(ctx))).toHaveLength(1);
});

it("reverses selection rounds without sending offers or changing accepted candidates", async () => {
	const { t, admin, periodId, ids } = await boardFixture();
	await asUser(t, admin).mutation(api.admissions.board.changeRound, {
		periodId,
		expectedRevision: 0,
		direction: "next",
	});
	const after = await t.run(async (ctx) => Promise.all(ids.map((id) => ctx.db.get(id))));
	expect(after.map((app) => app?.decision)).toEqual(["rejected", "pending", "accepted"]);
	expect(after.every((app) => !app?.decisionSentAt)).toBe(true);
	await asUser(t, admin).mutation(api.admissions.board.changeRound, {
		periodId,
		expectedRevision: 1,
		direction: "previous",
	});
	const restored = await t.run(async (ctx) => Promise.all(ids.map((id) => ctx.db.get(id))));
	expect(restored.map((app) => app?.decision)).toEqual(["pending", "shortlist", "accepted"]);
	expect(await t.run((ctx) => allOperations(ctx))).toEqual([]);
});

it("bulk room changes affect only selected interviews and reject empty rooms", async () => {
	const { t, admin, periodId, ids, now } = await boardFixture();
	await t.run(async (ctx) => {
		for (const [index, applicationId] of ids.entries()) {
			await ctx.db.insert(
				"admissionInterviews",
				interviewFields(periodId, applicationId, {
					startAt: now + 172800000 + index * 1200000,
					endAt: now + 173700000 + index * 1200000,
					revision: 0,
				}),
			);
		}
	});
	const first = ids[0];
	if (!first) throw new Error("Missing fixture application");
	await asUser(t, admin).mutation(api.admissions.board.assignRooms, {
		periodId,
		expectedRevision: 0,
		applicationIds: [first],
		room: "Alfa",
	});
	const interviews = await t.run((ctx) => ctx.db.query("admissionInterviews").collect());
	expect(interviews.filter((interview) => interview.room === "Alfa")).toHaveLength(1);
	expect(interviews.filter((interview) => interview.room === "Beta")).toHaveLength(2);
	await expect(
		asUser(t, admin).mutation(api.admissions.board.assignRooms, {
			periodId,
			expectedRevision: 1,
			applicationIds: ids,
			room: " ",
		}),
	).rejects.toThrow();
});

it("saves calendar selections only for eligible interviewers and rejects stale updates", async () => {
	const { t, admin, student, periodId } = await boardFixture();
	const helper = await insertUser(t, "helper@ifinavet.no");
	await grantRole(t, helper._id, "internal");
	const args = {
		periodId,
		expectedRevision: 0,
		interviewers: [
			{ userId: admin._id, selectedCalendarIds: ["primary"] },
			{ userId: helper._id, selectedCalendarIds: ["primary", "timetable"] },
		],
	};
	await expect(
		asUser(t, student).mutation(api.admissions.board.updateSettings, { ...args, settings: {} }),
	).rejects.toThrow();
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateSettings, {
			settings: {},
			...args,
			interviewers: [
				...args.interviewers,
				{ userId: student._id, selectedCalendarIds: ["primary"] },
			],
		}),
	).rejects.toThrow();
	await asUser(t, admin).mutation(api.admissions.board.updateSettings, { ...args, settings: {} });
	expect((await t.run((ctx) => ctx.db.get(periodId)))?.interviewers).toEqual(args.interviewers);
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateSettings, { ...args, settings: {} }),
	).rejects.toThrow();
});

it("archives the Slack channel after calendar cleanup and before purging the period", async () => {
	const { t, periodId, ids, now } = await boardFixture();
	const applicationId = ids[0];
	if (!applicationId) throw new Error("Missing fixture application");
	const interviewId = await t.run(async (ctx) => {
		await ctx.db.patch(periodId, { status: "closing" });
		return await ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				startAt: now,
				endAt: now + 900000,
				status: "cancelled",
			}),
		);
	});
	await t.run((ctx) =>
		stageOperation(ctx, {
			periodId,
			applicationId,
			interviewId,
			kind: "cancel_interview",
			revision: 1,
			idempotencyKey: "cleanup-test",
			state: "inProgress",
			dueAt: now,
		}),
	);
	await finishOperation(t, "cleanup-test");
	const archive = await t.run((ctx) => firstOperation(ctx, periodId, "archive_channel"));
	expect(archive).toMatchObject({ periodId, state: "inProgress" });
	expect(await t.run((ctx) => ctx.db.get(periodId))).not.toBeNull();
});

it("uses the interviewer's managed Workspace address for calendar delegation", async () => {
	const { t, admin, periodId, now } = await boardFixture();
	await t.run(async (ctx) => {
		await ctx.db.patch(admin._id, { email: "board@uio.no" });
		await ctx.db.patch(periodId, {
			interviewers: [{ userId: admin._id, selectedCalendarIds: ["primary"] }],
		});
		await ctx.db.insert("memberAccounts", {
			userId: admin._id,
			workspaceEmail: "board.member@ifinavet.no",
			uioEmail: "board@uio.no",
			firstName: "Board",
			lastName: "Member",
			group: "Web",
			stage: "active",
			google: "existing",
			updatedAt: now,
		});
	});
	const access = await asUser(t, admin).query(internal.admissions.internal.calendarAccess, {
		periodId,
		interviewerId: admin._id,
	});
	expect(access.email).toBe("board.member@ifinavet.no");
});

it("limits bulk room conflict checks to rooms without rejecting unchanged interviewer overlaps", async () => {
	const { t, admin, periodId, ids, now } = await boardFixture();
	const first = ids[0];
	const second = ids[1];
	if (!first || !second) throw new Error("Missing candidates");
	await t.run(async (ctx) => {
		for (const [applicationId, room] of [
			[first, "Beta"],
			[second, "Alfa"],
		] as const)
			await ctx.db.insert(
				"admissionInterviews",
				interviewFields(periodId, applicationId, {
					startAt: now + 3 * 86400000,
					endAt: now + 3 * 86400000 + 900000,
					interviewerIds: [admin._id],
					room,
				}),
			);
	});
	await asUser(t, admin).mutation(api.admissions.board.assignRooms, {
		periodId,
		expectedRevision: 0,
		applicationIds: [first],
		room: "Gamma",
	});
	await expect(
		asUser(t, admin).mutation(api.admissions.board.assignRooms, {
			periodId,
			expectedRevision: 1,
			applicationIds: [first],
			room: "Alfa",
		}),
	).rejects.toThrow(/Rommet er allerede i bruk/);
});
