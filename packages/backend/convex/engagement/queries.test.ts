import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertEvent,
	insertRegistration,
	insertStudent,
	insertUser,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const at = (iso: string) => Date.parse(iso);

async function internTester() {
	const { t, companyId } = await setup();
	const intern = await insertUser(t, "intern@example.com");
	await grantRole(t, intern._id, "internal");
	return { t, companyId, intern: asUser(t, intern) };
}

async function registerStudent(
	t: Awaited<ReturnType<typeof setup>>["t"],
	email: string,
	eventId: Id<"events">,
	year: number,
	time: number,
) {
	const user = await insertUser(t, email);
	await insertStudent(t, user._id, { year });
	await insertRegistration(t, eventId, user._id, "registered", time);
	return user;
}

function startLogAt(time: number) {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(time);
}

async function firstLogCreation(t: Awaited<ReturnType<typeof setup>>["t"]) {
	return await t.run(async (ctx) => (await ctx.db.query("registrationLog").first())?._creationTime);
}

afterEach(() => {
	vi.useRealTimers();
});

describe("semester", () => {
	it("compares autumn cohorts against the same students a year younger last spring", async () => {
		const { t, companyId, intern } = await internTester();
		const now = at("2026-10-01T10:00:00Z");
		const current = await insertEvent(t, companyId, {
			registrationOpens: at("2026-09-20T10:00:00Z"),
			eventStart: at("2026-10-05T16:00:00Z"),
		});
		const early = await insertEvent(t, companyId, {
			registrationOpens: at("2026-01-10T10:00:00Z"),
			eventStart: at("2026-01-20T16:00:00Z"),
		});
		const late = await insertEvent(t, companyId, {
			registrationOpens: at("2026-05-01T10:00:00Z"),
			eventStart: at("2026-05-10T16:00:00Z"),
		});
		await registerStudent(t, "ada@example.com", current, 2, now - DAY_IN_MS);
		await registerStudent(t, "bo@example.com", early, 3, now - DAY_IN_MS);
		await registerStudent(t, "cy@example.com", late, 2, now - DAY_IN_MS);

		const { audience } = await intern.query(api.engagement.queries.semester, { now });

		expect(
			audience.cohorts.map(({ label, reach, previousReach }) => ({ label, reach, previousReach })),
		).toEqual([{ label: "Bachelor 2. år", reach: 1 / 2, previousReach: 1 }]);
	});

	it("keeps cohorts unshifted when comparing spring against the autumn before", async () => {
		const { t, companyId, intern } = await internTester();
		const now = at("2027-03-01T10:00:00Z");
		const current = await insertEvent(t, companyId, {
			registrationOpens: at("2027-02-20T10:00:00Z"),
			eventStart: at("2027-03-05T16:00:00Z"),
		});
		const previous = await insertEvent(t, companyId, {
			registrationOpens: at("2026-08-20T10:00:00Z"),
			eventStart: at("2026-09-01T16:00:00Z"),
		});
		await registerStudent(t, "ada@example.com", current, 2, now - DAY_IN_MS);
		await registerStudent(t, "bo@example.com", previous, 2, now - DAY_IN_MS);

		const { audience } = await intern.query(api.engagement.queries.semester, { now });

		expect(audience.cohorts.map(({ reach, previousReach }) => ({ reach, previousReach }))).toEqual([
			{ reach: 1 / 2, previousReach: 1 / 2 },
		]);
	});

	it("counts late unregistrations only for events the log covers", async () => {
		startLogAt(at("2026-09-10T12:00:00Z"));
		const { t, companyId, intern } = await internTester();
		const now = at("2026-10-20T10:00:00Z");
		const uncovered = await insertEvent(t, companyId, {
			registrationOpens: at("2026-09-01T10:00:00Z"),
			eventStart: at("2026-09-10T16:00:00Z"),
		});
		const covered = await insertEvent(t, companyId, {
			registrationOpens: at("2026-10-01T10:00:00Z"),
			eventStart: at("2026-10-10T16:00:00Z"),
		});
		const user = await insertUser(t, "ada@example.com");
		await t.run(async (ctx) => {
			for (const eventId of [uncovered, covered]) {
				const event = await ctx.db.get(eventId);
				await ctx.db.insert("registrationLog", {
					eventId,
					userId: user._id,
					change: "unregistered",
					fromStatus: "registered",
					at: (event?.eventStart ?? 0) - 60 * 60 * 1000,
				});
			}
		});

		const logStart = await firstLogCreation(t);

		const { lateUnregistrations } = await intern.query(api.engagement.queries.semester, { now });

		expect(lateUnregistrations).toEqual({ current: 1, since: logStart, lastYear: null });
	});

	it("compares late unregistrations against last year once the log covers both", async () => {
		startLogAt(at("2025-01-01T00:00:00Z"));
		const { t, companyId, intern } = await internTester();
		const seed = await insertEvent(t, companyId, { eventStart: at("2024-12-01T16:00:00Z") });
		const user = await insertUser(t, "ada@example.com");
		await t.run((ctx) =>
			ctx.db.insert("registrationLog", {
				eventId: seed,
				userId: user._id,
				change: "registered",
				at: Date.now(),
			}),
		);
		const now = at("2026-10-20T10:00:00Z");
		await insertEvent(t, companyId, {
			registrationOpens: at("2026-10-01T10:00:00Z"),
			eventStart: at("2026-10-10T16:00:00Z"),
		});
		await insertEvent(t, companyId, {
			registrationOpens: at("2025-10-01T10:00:00Z"),
			eventStart: at("2025-10-10T16:00:00Z"),
		});

		const { lateUnregistrations } = await intern.query(api.engagement.queries.semester, { now });

		expect(lateUnregistrations).toEqual({ current: 0, since: null, lastYear: 0 });
	});
});

describe("past", () => {
	it("lists finished events in the semester newest first with attendance and log coverage", async () => {
		startLogAt(at("2026-09-20T00:00:00Z"));
		const { t, companyId, intern } = await internTester();
		const now = at("2026-10-20T10:00:00Z");
		const older = await insertEvent(t, companyId, {
			title: "Eldre",
			registrationOpens: at("2026-09-01T10:00:00Z"),
			eventStart: at("2026-09-10T16:00:00Z"),
		});
		const newer = await insertEvent(t, companyId, {
			title: "Nyere",
			registrationOpens: at("2026-10-01T10:00:00Z"),
			eventStart: at("2026-10-10T16:00:00Z"),
		});
		await insertEvent(t, companyId, {
			title: "Kommende",
			registrationOpens: at("2026-10-15T10:00:00Z"),
			eventStart: at("2026-10-25T16:00:00Z"),
		});
		await insertEvent(t, companyId, {
			title: "Forrige semester",
			registrationOpens: at("2026-05-01T10:00:00Z"),
			eventStart: at("2026-05-10T16:00:00Z"),
		});
		const ada = await registerStudent(t, "ada@example.com", newer, 2, now - 20 * DAY_IN_MS);
		const bo = await registerStudent(t, "bo@example.com", newer, 2, now - 20 * DAY_IN_MS);
		await registerStudent(t, "cy@example.com", older, 2, now - 50 * DAY_IN_MS);
		await t.run(async (ctx) => {
			const registrations = await ctx.db
				.query("registrations")
				.withIndex("by_eventId", (q) => q.eq("eventId", newer))
				.collect();
			for (const registration of registrations) {
				await ctx.db.patch(registration._id, {
					attendanceStatus: registration.userId === ada._id ? "confirmed" : "no_show",
				});
			}
			await ctx.db.insert("registrationLog", {
				eventId: newer,
				userId: bo._id,
				change: "unregistered",
				fromStatus: "registered",
				at: at("2026-10-10T10:00:00Z"),
			});
		});

		const past = await intern.query(api.engagement.queries.past, {
			now,
			semester: "høst",
			year: 2026,
		});

		expect(
			past.map(({ _id, title, registered, attended, lateUnregistrations }) => ({
				_id,
				title,
				registered,
				attended,
				lateUnregistrations,
			})),
		).toEqual([
			{ _id: newer, title: "Nyere", registered: 2, attended: 1, lateUnregistrations: 1 },
			{ _id: older, title: "Eldre", registered: 1, attended: null, lateUnregistrations: null },
		]);
	});
});

describe("paceCurve", () => {
	it("drops the projection once registration has closed", async () => {
		const { t, companyId, intern } = await internTester();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: at("2026-10-01T10:00:00Z"),
			eventStart: at("2026-10-10T16:00:00Z"),
		});
		await registerStudent(t, "ada@example.com", eventId, 2, at("2026-10-02T10:00:00Z"));

		const curve = await intern.query(api.engagement.queries.paceCurve, {
			eventId,
			now: at("2026-10-20T10:00:00Z"),
		});

		expect(curve?.progress).toBe(1);
		expect(curve?.registered).toBe(1);
		expect(curve?.projected).toBeNull();
		expect(curve?.points.every(({ projected }) => projected === null)).toBe(true);
	});

	it("projects the final count while registration is open", async () => {
		const { t, companyId, intern } = await internTester();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: at("2026-10-01T10:00:00Z"),
			eventStart: at("2026-10-11T10:00:00Z"),
		});
		await registerStudent(t, "ada@example.com", eventId, 2, at("2026-10-02T10:00:00Z"));

		const curve = await intern.query(api.engagement.queries.paceCurve, {
			eventId,
			now: at("2026-10-06T10:00:00Z"),
		});

		expect(curve?.progress).toBe(0.5);
		expect(curve?.projected).toBe(2);
	});

	it("shows no projection before anyone has registered", async () => {
		const { t, companyId, intern } = await internTester();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: at("2026-10-01T10:00:00Z"),
			eventStart: at("2026-10-11T10:00:00Z"),
		});

		const curve = await intern.query(api.engagement.queries.paceCurve, {
			eventId,
			now: at("2026-10-06T10:00:00Z"),
		});

		expect(curve?.projected).toBeNull();
	});
});
