import { osloDateTimeToEpoch } from "@workspace/shared/time";
import { expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

it("keeps published slots pinned and does not rebook cancelled interviews automatically", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const interviewerOne = await insertUser(t, "one@ifinavet.no");
	const interviewerTwo = await insertUser(t, "two@ifinavet.no");
	await grantRole(t, interviewerOne._id, "internal");
	await grantRole(t, interviewerTwo._id, "internal");
	const publishedApplicant = await insertUser(t, "published@uio.no");
	const cancelledApplicant = await insertUser(t, "cancelled@uio.no");
	const availableApplicant = await insertUser(t, "available@uio.no");
	const day = "2026-10-12";
	const startAt = osloDateTimeToEpoch(day, "09:00");
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", {
			title: "Høst 2026",
			applicationStartAt: now - 86400000,
			applicationEndAt: now + 86400000,
			interviewStartAt: startAt,
			interviewEndAt: osloDateTimeToEpoch(day, "11:00"),
			retentionAt: now + 1209600000,
			status: "open",
			revision: 0,
			interviewers: [
				{ userId: interviewerOne._id, selectedCalendarIds: ["navet"] },
				{ userId: interviewerTwo._id, selectedCalendarIds: ["navet"] },
			],
			duration: 15,
			buffer: 5,
			breakEvery: 3,
			breakMinutes: 15,
			lunch: false,
			room: "Beta",
			dayStart: 540,
			dayEnd: 660,
			breaks: [],
			timezone: "Europe/Oslo",
			round: 1,
			roundHistory: [],
			createdBy: admin._id,
			updatedBy: admin._id,
		}),
	);
	const availability = [{ day, start: 540, end: 660 }];
	const applications = await t.run(async (ctx) => {
		const createApplication = async (userId: typeof publishedApplicant._id) =>
			ctx.db.insert("admissionApplications", {
				periodId,
				userId,
				studentProfile: {
					name: "Applicant",
					studyProgram: "Informatikk",
					year: 1,
					degree: "Bachelor",
				},
				availability,
				status: "submitted",
				revision: 1,
				decisionRevision: 0,
				decision: "pending",
				offerStatus: "none",
				sent: false,
			});
		return {
			published: await createApplication(publishedApplicant._id),
			cancelled: await createApplication(cancelledApplicant._id),
			available: await createApplication(availableApplicant._id),
		};
	});
	await t.run(async (ctx) => {
		await ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId: applications.published,
			startAt,
			endAt: startAt + 15 * 60000,
			interviewerIds: [interviewerOne._id, interviewerTwo._id],
			selectedCalendarIds: ["navet"],
			room: "Beta",
			calendarEventId: "published-event",
			publishedAt: now,
			status: "scheduled",
			revision: 1,
		});
		await ctx.db.insert("admissionInterviews", {
			periodId,
			applicationId: applications.cancelled,
			startAt: startAt + 60 * 60000,
			endAt: startAt + 75 * 60000,
			interviewerIds: [interviewerOne._id, interviewerTwo._id],
			selectedCalendarIds: ["navet"],
			room: "Beta",
			status: "cancelled",
			revision: 2,
		});
	});
	process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3210";
	process.env.APP_ENV = "local";
	try {
		const result = await asUser(t, admin).action(api.admissions.calendar.generateSchedule, {
			periodId,
			expectedRevision: 0,
		});
		expect(result.count).toBe(2);
		const interviews = await t.run((ctx) =>
			ctx.db
				.query("admissionInterviews")
				.withIndex("by_periodId_and_status", (q) =>
					q.eq("periodId", periodId).eq("status", "scheduled"),
				)
				.collect(),
		);
		expect(interviews).toHaveLength(2);
		expect(
			interviews.find(({ applicationId }) => applicationId === applications.published)?.startAt,
		).toBe(startAt);
		expect(
			interviews.find(({ applicationId }) => applicationId === applications.available)?.startAt,
		).toBeGreaterThanOrEqual(startAt + 20 * 60000);
		const cancelled = await t.run((ctx) =>
			ctx.db
				.query("admissionInterviews")
				.withIndex("by_applicationId", (q) => q.eq("applicationId", applications.cancelled))
				.unique(),
		);
		expect(cancelled?.status).toBe("cancelled");
	} finally {
		delete process.env.CONVEX_CLOUD_URL;
		delete process.env.APP_ENV;
	}
});
