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
	vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-05T08:00:00Z"));
	vi.spyOn(config, "googleConfig").mockReturnValue({
		serviceAccountEmail: "service@example.test",
		privateKey: "test-key",
		adminEmail: "admin@ifinavet.no",
		domain: "ifinavet.no",
	});
	const createClient = google.googleCalendarClient;
	vi.spyOn(google, "googleCalendarClient").mockImplementation((...args) => {
		createClient(...args);
		return provider;
	});
	provider.listCalendars.mockResolvedValue([
		{ id: "navet", summary: "Navet" },
		{ id: "timetable", summary: "Timeplan" },
		{ id: "personal", summary: "Privat" },
	]);
	provider.freeBusy.mockImplementation(async (ids: string[]) =>
		Object.fromEntries(ids.map((id) => [id, { busy: [] }])),
	);
	provider.listEvents.mockResolvedValue([]);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

async function seedSchedulingPeriod() {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const interviewerOne = await insertUser(t, "one@ifinavet.no");
	const interviewerTwo = await insertUser(t, "two@ifinavet.no");
	await grantRole(t, interviewerOne._id, "internal");
	await grantRole(t, interviewerTwo._id, "internal");
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
	return { t, admin, interviewerOne, interviewerTwo, day, startAt, now, periodId };
}

it("keeps published slots pinned and does not rebook cancelled interviews automatically", async () => {
	const { t, admin, interviewerOne, interviewerTwo, day, startAt, now, periodId } =
		await seedSchedulingPeriod();
	const publishedApplicant = await insertUser(t, "published@uio.no");
	const cancelledApplicant = await insertUser(t, "cancelled@uio.no");
	const availableApplicant = await insertUser(t, "available@uio.no");
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
	).rejects.toMatchObject({
		data: "Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.",
	});
	await expect(
		adminClient.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 1,
		}),
	).rejects.toMatchObject({
		data: "Google Calendar mangler tjenestekonto eller Workspace-konfigurasjon.",
	});
	expect(provider.listCalendars).not.toHaveBeenCalled();
	expect(provider.freeBusy).not.toHaveBeenCalled();
});

it.each(["free", "busy", "missing", "unreadable", "unselected"] as const)(
	"generates interviews only with usable selected calendars (%s)",
	async (mode) => {
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
					selectedCalendarIds:
						mode === "unselected" && person === second ? [] : ["primary", "personal"],
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
		if (mode === "busy") {
			const intervals = {
				primary: {
					start: new Date(osloDateTimeToEpoch(day, "09:00")).toISOString(),
					end: new Date(osloDateTimeToEpoch(day, "10:00")).toISOString(),
				},
				personal: {
					start: new Date(osloDateTimeToEpoch(day, "10:00")).toISOString(),
					end: new Date(osloDateTimeToEpoch(day, "11:00")).toISOString(),
				},
			};
			provider.freeBusy.mockResolvedValue(
				Object.fromEntries(
					Object.entries(intervals).map(([id, interval]) => [id, { busy: [interval] }]),
				),
			);
			provider.listEvents.mockImplementation(async (id: keyof typeof intervals) => [
				{
					id: `external-${id}`,
					start: { dateTime: intervals[id].start },
					end: { dateTime: intervals[id].end },
				},
			]);
		}
		if (mode === "missing") provider.freeBusy.mockResolvedValue({ primary: { busy: [] } });
		if (mode === "unreadable")
			provider.freeBusy.mockRejectedValue(new Error("calendar access denied"));
		const generated = adminClient.action(api.admissions.interviews.calendar.generateSchedule, {
			periodId,
			expectedRevision: 1,
		});
		if (mode === "missing" || mode === "unreadable") {
			await expect(generated).rejects.toThrow(
				mode === "missing" ? /kan ikke leses/ : /access denied/,
			);
			expect(await t.run((ctx) => ctx.db.query("admissionInterviews").collect())).toEqual([]);
			return;
		}
		const counts = { free: 12, busy: 11, unselected: 0 };
		const count = counts[mode];
		await expect(generated).resolves.toEqual({ count });
		expect(provider.freeBusy).toHaveBeenCalledTimes(mode === "unselected" ? 1 : 2);
		const interviews = (await t.run((ctx) => ctx.db.query("admissionInterviews").collect())).sort(
			(a, b) => a.startAt - b.startAt,
		);
		expect(interviews).toHaveLength(count);
		for (const [index, interview] of interviews.entries()) {
			expect(new Set(interview.interviewerIds)).toEqual(new Set([admin._id, second._id]));
			expect(interview.endAt - interview.startAt).toBe(15 * 60_000);
			expect(interview.room).toBe("Beta");
			if (mode === "busy")
				expect(interview.startAt).toBeGreaterThanOrEqual(osloDateTimeToEpoch(day, "11:00"));
			expect(interview.publishedAt).toBeUndefined();
			const previous = interviews[index - 1];
			if (previous) expect(interview.startAt).toBeGreaterThanOrEqual(previous.endAt + 5 * 60_000);
		}
	},
);

it("suggests free times with two interviewers, ranked by the candidate's availability", async () => {
	const { t, admin, interviewerOne, interviewerTwo, day, startAt, periodId } =
		await seedSchedulingPeriod();
	const insertApplication = async (
		email: string,
		availability: { day: string; start: number; end: number }[],
	) => {
		const user = await insertUser(t, email);
		return t.run((ctx) =>
			ctx.db.insert(
				"admissionApplications",
				applicationFields(periodId, user._id, { availability }),
			),
		);
	};
	const booked = await insertApplication("booked@uio.no", [{ day, start: 540, end: 660 }]);
	const nearby = await insertApplication("nearby@uio.no", [{ day, start: 600, end: 640 }]);
	const otherDay = await insertApplication("other@uio.no", [
		{ day: "2026-10-13", start: 540, end: 660 },
	]);
	await t.run((ctx) =>
		ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, booked, {
				startAt,
				endAt: startAt + 15 * 60000,
				interviewerIds: [interviewerOne._id, interviewerTwo._id],
				selectedCalendarIds: ["navet"],
			}),
		),
	);
	const client = asUser(t, admin);
	const suggestions = await client.action(api.admissions.interviews.calendar.suggestTimes, {
		periodId,
		applicationId: nearby,
	});
	expect(suggestions.length).toBeGreaterThan(0);
	expect(suggestions.length).toBeLessThanOrEqual(5);
	expect(suggestions.every(({ startAt: time }) => time !== startAt)).toBe(true);
	expect(suggestions.every(({ interviewerIds }) => interviewerIds.length === 2)).toBe(true);
	expect(suggestions[0]?.withinAvailability).toBe(true);
	for (const suggestion of suggestions.filter(({ withinAvailability }) => withinAvailability)) {
		expect(suggestion.startAt).toBeGreaterThanOrEqual(osloDateTimeToEpoch(day, "10:00"));
		expect(suggestion.startAt + 15 * 60000).toBeLessThanOrEqual(osloDateTimeToEpoch(day, "10:40"));
	}
	expect(suggestions.at(-1)?.withinAvailability).toBe(false);

	const fallback = await client.action(api.admissions.interviews.calendar.suggestTimes, {
		periodId,
		applicationId: otherDay,
	});
	expect(fallback.map(({ withinAvailability }) => withinAvailability)).not.toContain(true);
	expect(fallback[0]?.startAt).toBe(startAt + 20 * 60000);

	await expect(
		asUser(t, interviewerOne).action(api.admissions.interviews.calendar.suggestTimes, {
			periodId,
			applicationId: nearby,
		}),
	).rejects.toThrow();
});
