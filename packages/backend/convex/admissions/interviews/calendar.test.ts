import { osloDateTimeToEpoch } from "@workspace/shared/time";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	admissionPeriodFixture,
	applicationFields,
	interviewFields,
	periodFields,
} from "../../../test/admissions-fixtures";
import { asUser, grantRole, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";

import * as config from "../../iam/config";
import * as google from "../../iam/googleCalendar";

const provider = {
	listCalendars: vi.fn(),
	freeBusy: vi.fn(),
	listEvents: vi.fn(),
	getEvent: vi.fn(),
	upsertEvent: vi.fn(),
	cancelEvent: vi.fn(),
};
beforeEach(() => {
	vi.spyOn(config, "googleConfig").mockReturnValue({
		serviceAccountEmail: "service@example.test",
		privateKey: "test-key",
		adminEmail: "admin@ifinavet.no",
		domain: "ifinavet.no",
	});
	vi.spyOn(google, "googleCalendarClient").mockReturnValue(provider);
	provider.listCalendars.mockResolvedValue([
		{ id: "navet", summary: "Navet" },
		{ id: "timetable", summary: "Timeplan" },
		{ id: "personal", summary: "Privat" },
	]);
	provider.freeBusy.mockResolvedValue({});
	provider.listEvents.mockResolvedValue([]);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

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
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				applicationStartAt: now - 86400000,
				applicationEndAt: now + 86400000,
				interviewStartAt: startAt,
				interviewEndAt: osloDateTimeToEpoch(day, "11:00"),
				retentionAt: now + 1209600000,
				revision: 0,
				interviewers: [
					{ userId: interviewerOne._id, selectedCalendarIds: ["navet"] },
					{ userId: interviewerTwo._id, selectedCalendarIds: ["navet"] },
				],
				lunch: false,
				dayEnd: 660,
			}),
		),
	);
	const availability = [{ day, start: 540, end: 660 }];
	const applications = await t.run(async (ctx) => {
		const createApplication = async (userId: typeof publishedApplicant._id) =>
			ctx.db.insert(
				"admissionApplications",
				applicationFields(periodId, userId, {
					studentProfile: {
						name: "Applicant",
						studyProgram: "Informatikk",
						year: 1,
						degree: "Bachelor",
					},
					availability: availability,
				}),
			);
		return {
			published: await createApplication(publishedApplicant._id),
			cancelled: await createApplication(cancelledApplicant._id),
			available: await createApplication(availableApplicant._id),
		};
	});
	await t.run(async (ctx) => {
		await ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applications.published, {
				startAt: startAt,
				endAt: startAt + 15 * 60000,
				interviewerIds: [interviewerOne._id, interviewerTwo._id],
				selectedCalendarIds: ["navet"],
				calendarEventId: "published-event",
				publishedAt: now,
			}),
		);
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
	const result = await asUser(t, admin).action(
		api.admissions.interviews.calendar.generateSchedule,
		{
			periodId,
			expectedRevision: 0,
		},
	);
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
});

it("uses provider calendars for defaults and saved selections, with admin authorization", async () => {
	const { t, admin, adminClient, periodId } = await admissionPeriodFixture();
	await t.run(async (ctx) => {
		await ctx.db.patch(admin._id, { email: "admin@ifinavet.no" });
		await ctx.db.patch(periodId, {
			interviewers: [{ userId: admin._id, selectedCalendarIds: [] }],
		});
	});
	const args = { periodId, interviewerId: admin._id };
	await expect(t.action(api.admissions.interviews.calendar.sources, args)).rejects.toThrow(
		/Unauthorized/,
	);
	expect(provider.listCalendars).not.toHaveBeenCalled();
	expect(await adminClient.action(api.admissions.interviews.calendar.sources, args)).toEqual([
		{ id: "navet", name: "Navet", selected: true, readable: true },
		{ id: "timetable", name: "Timeplan", selected: true, readable: true },
		{ id: "personal", name: "Privat", selected: false, readable: true },
	]);
	expect(provider.freeBusy).toHaveBeenCalledTimes(3);
	expect(provider.listEvents).toHaveBeenCalledTimes(3);
	await t.run((ctx) =>
		ctx.db.patch(periodId, {
			interviewers: [{ userId: admin._id, selectedCalendarIds: ["personal"] }],
		}),
	);
	expect(
		(await adminClient.action(api.admissions.interviews.calendar.sources, args))
			.filter((calendar) => calendar.selected)
			.map((calendar) => calendar.id),
	).toEqual(["personal"]);
});

it("fails calendar discovery and scheduling when Google configuration is missing", async () => {
	const { t, admin, adminClient, periodId } = await admissionPeriodFixture();
	await t.run((ctx) =>
		ctx.db.patch(periodId, {
			interviewers: [{ userId: admin._id, selectedCalendarIds: ["navet"] }],
		}),
	);
	vi.mocked(config.googleConfig).mockReturnValue(null);
	await expect(
		adminClient.action(api.admissions.interviews.calendar.sources, {
			periodId,
			interviewerId: admin._id,
		}),
	).rejects.toThrow(/mangler tjenestekonto/);
	await expect(
		adminClient.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 1,
		}),
	).rejects.toThrow(/mangler tjenestekonto/);
	expect(provider.listCalendars).not.toHaveBeenCalled();
	expect(provider.freeBusy).not.toHaveBeenCalled();
});

it("generates twelve provider-checked interviews without overlapping interviewers or buffers", async () => {
	const { t, admin, adminClient, periodId } = await admissionPeriodFixture({ lunch: false });
	const second = await insertUser(t, "second@ifinavet.no");
	await grantRole(t, second._id, "internal");
	const day = "2026-10-12";
	await t.run(async (ctx) => {
		await ctx.db.patch(admin._id, { email: "admin@ifinavet.no" });
		await ctx.db.patch(periodId, {
			interviewStartAt: osloDateTimeToEpoch(day, "09:00"),
			interviewEndAt: osloDateTimeToEpoch(day, "16:00"),
			interviewers: [admin, second].map((person) => ({
				userId: person._id,
				selectedCalendarIds: ["primary"],
			})),
		});
	});
	await Promise.all(
		Array.from({ length: 12 }, async (_, index) => {
			const applicant = await insertUser(t, `candidate-${index}@uio.no`);
			await t.run((ctx) =>
				ctx.db.insert(
					"admissionApplications",
					applicationFields(periodId, applicant._id, {
						availability: [{ day, start: 540, end: 960 }],
					}),
				),
			);
		}),
	);
	expect(
		await adminClient.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 1,
		}),
	).toEqual({ count: 12 });
	expect(provider.freeBusy).toHaveBeenCalledTimes(2);
	const interviews = (await t.run((ctx) => ctx.db.query("admissionInterviews").collect())).sort(
		(a, b) => a.startAt - b.startAt,
	);
	expect(interviews).toHaveLength(12);
	for (const [index, interview] of interviews.entries()) {
		expect(new Set(interview.interviewerIds)).toEqual(new Set([admin._id, second._id]));
		expect(interview.endAt - interview.startAt).toBe(15 * 60_000);
		expect(interview.room).toBe("Beta");
		expect(interview.publishedAt).toBeUndefined();
		const previous = interviews[index - 1];
		if (previous) expect(interview.startAt).toBeGreaterThanOrEqual(previous.endAt + 5 * 60_000);
	}
});
