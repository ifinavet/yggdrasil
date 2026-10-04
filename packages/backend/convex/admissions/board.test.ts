import { expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

async function boardFixture() {
	const { t } = await setup();
	const admin = await insertUser(t, "board@ifinavet.no");
	await grantRole(t, admin._id, "admin");
	const student = await insertUser(t, "applicant@uio.no");
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", {
			title: "Høst 2026",
			applicationStartAt: now - 1000,
			applicationEndAt: now + 86400000,
			interviewStartAt: now + 172800000,
			interviewEndAt: now + 604800000,
			retentionAt: now + 1209600000,
			status: "open",
			revision: 0,
			interviewers: [],
			duration: 15,
			buffer: 5,
			breakEvery: 3,
			breakMinutes: 15,
			lunch: true,
			room: "Beta",
			dayStart: 540,
			dayEnd: 960,
			breaks: [],
			timezone: "Europe/Oslo",
			round: 1,
			roundHistory: [],
			createdBy: admin._id,
			updatedBy: admin._id,
		}),
	);
	const ids = await t.run(async (ctx) => {
		const result = [];
		for (const decision of ["pending", "shortlist", "accepted"] as const) {
			result.push(
				await ctx.db.insert("admissionApplications", {
					periodId,
					userId: student._id,
					availability: [],
					status: "submitted",
					revision: 0,
					decision,
					sent: false,
					offerStatus: "none",
					decisionRevision: 0,
				}),
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

it("reverses selection rounds without sending offers or changing accepted candidates", async () => {
	const { t, admin, periodId, ids } = await boardFixture();
	await asUser(t, admin).mutation(api.admissions.board.changeRound, {
		periodId,
		expectedRevision: 0,
		direction: "next",
	});
	const after = await t.run(async (ctx) => Promise.all(ids.map((id) => ctx.db.get(id))));
	expect(after.map((app) => app?.decision)).toEqual(["rejected", "pending", "accepted"]);
	expect(after.every((app) => !app?.sent)).toBe(true);
	await asUser(t, admin).mutation(api.admissions.board.changeRound, {
		periodId,
		expectedRevision: 1,
		direction: "previous",
	});
	const restored = await t.run(async (ctx) => Promise.all(ids.map((id) => ctx.db.get(id))));
	expect(restored.map((app) => app?.decision)).toEqual(["pending", "shortlist", "accepted"]);
	expect(await t.run((ctx) => ctx.db.query("admissionOutbox").collect())).toEqual([]);
});

it("bulk room changes affect only selected interviews and reject empty rooms", async () => {
	const { t, admin, periodId, ids, now } = await boardFixture();
	await t.run(async (ctx) => {
		for (const [index, applicationId] of ids.entries()) {
			await ctx.db.insert("admissionInterviews", {
				periodId,
				applicationId,
				startAt: now + 172800000 + index * 1200000,
				endAt: now + 173700000 + index * 1200000,
				interviewerIds: [],
				selectedCalendarIds: [],
				room: "Beta",
				status: "scheduled",
				revision: 0,
			});
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
		asUser(t, student).mutation(api.admissions.board.updateInterviewers, args),
	).rejects.toThrow();
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateInterviewers, {
			...args,
			interviewers: [
				...args.interviewers,
				{ userId: student._id, selectedCalendarIds: ["primary"] },
			],
		}),
	).rejects.toThrow();
	await asUser(t, admin).mutation(api.admissions.board.updateInterviewers, args);
	expect((await t.run((ctx) => ctx.db.get(periodId)))?.interviewers).toEqual(args.interviewers);
	await expect(
		asUser(t, admin).mutation(api.admissions.board.updateInterviewers, args),
	).rejects.toThrow();
});
