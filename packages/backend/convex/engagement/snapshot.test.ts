import { DAY_MS, HOUR_MS } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import {
	insertEvent,
	insertRegistration,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import type { Doc, Id } from "../_generated/dataModel";
import { logRegistrationChange } from "./log";
import { PACE_GRID } from "./metrics";
import {
	baselineFor,
	companyCurvesBefore,
	logSince,
	pastCurvesBefore,
	registrationTimesOf,
	snapshotOf,
	UNREGISTRATION_HISTORY_START,
	upcomingEvents,
	waitlistCountOf,
} from "./snapshot";

const OPENS = Date.UTC(2026, 8, 1, 10);
const START = OPENS + 10 * DAY_MS;

async function registerUsers(t: TestBackend, eventId: Id<"events">, count: number, at: number) {
	for (let index = 0; index < count; index += 1) {
		const user = await insertUser(t, `bruker${eventId}-${index}@example.com`);
		await insertRegistration(t, eventId, user._id, "registered", at + index);
		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: user._id }, "registered", at + index),
		);
	}
}

async function pastEvent(
	t: TestBackend,
	companyId: Id<"companies">,
	daysBefore: number,
	seats: number,
) {
	const eventId = await insertEvent(t, companyId, {
		eventStart: START - daysBefore * DAY_MS,
		registrationOpens: OPENS - daysBefore * DAY_MS,
		participationLimit: 10,
		published: true,
		externalEvent: false,
	});
	await registerUsers(t, eventId, seats, OPENS - daysBefore * DAY_MS + HOUR_MS);
	return eventId;
}

async function eventDoc(t: TestBackend, eventId: Id<"events">): Promise<Doc<"events">> {
	const event = await t.run((ctx) => ctx.db.get(eventId));
	if (!event) throw new Error("Expected the event to exist.");
	return event;
}

describe("registrationTimesOf", () => {
	it("returns only registered registration times", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: OPENS,
			eventStart: START,
		});
		const registered = await insertUser(t, "registrert@example.com");
		await insertRegistration(t, eventId, registered._id, "registered", OPENS + HOUR_MS);
		const waiting = await insertUser(t, "venter@example.com");
		await insertRegistration(t, eventId, waiting._id, "waitlist", OPENS + 2 * HOUR_MS);

		const times = await t.run((ctx) => registrationTimesOf(ctx, eventId));
		expect(times).toEqual([OPENS + HOUR_MS]);
	});
});

describe("waitlistCountOf", () => {
	it("counts only waitlisted registrations", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const registered = await insertUser(t, "registrert2@example.com");
		await insertRegistration(t, eventId, registered._id, "registered");
		const waitingA = await insertUser(t, "venter2@example.com");
		await insertRegistration(t, eventId, waitingA._id, "waitlist");
		const waitingB = await insertUser(t, "venter3@example.com");
		await insertRegistration(t, eventId, waitingB._id, "waitlist");

		const count = await t.run((ctx) => waitlistCountOf(ctx, eventId));
		expect(count).toBe(2);
	});
});

describe("logSince", () => {
	it("returns only log entries strictly after the given timestamp", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const user = await insertUser(t, "logg@example.com");
		const since = OPENS + DAY_MS;

		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: user._id }, "registered", since),
		);
		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: user._id }, "registered", since - 1),
		);
		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: user._id }, "unregistered", since + 1),
		);

		const entries = await t.run((ctx) => logSince(ctx, eventId, since));
		expect(entries.map((entry) => entry.at)).toEqual([since + 1]);
	});
});

describe("pastCurvesBefore", () => {
	it("only includes published, internal events with a positive limit that started earlier", async () => {
		const { t, companyId } = await setup();
		const before = START + 30 * DAY_MS;

		const eligible = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
			participationLimit: 4,
			published: true,
			externalEvent: false,
		});
		await registerUsers(t, eligible, 2, OPENS + HOUR_MS);

		await insertEvent(t, companyId, {
			eventStart: START + HOUR_MS,
			registrationOpens: OPENS,
			participationLimit: 4,
			published: false,
			externalEvent: false,
		});
		await insertEvent(t, companyId, {
			eventStart: START + 2 * HOUR_MS,
			registrationOpens: OPENS,
			participationLimit: 4,
			published: true,
			externalEvent: true,
		});
		await insertEvent(t, companyId, {
			eventStart: START + 3 * HOUR_MS,
			registrationOpens: OPENS,
			participationLimit: 0,
			published: true,
			externalEvent: false,
		});
		await insertEvent(t, companyId, {
			eventStart: before + HOUR_MS,
			registrationOpens: OPENS,
			participationLimit: 4,
			published: true,
			externalEvent: false,
		});

		const curves = await t.run((ctx) => pastCurvesBefore(ctx, before));
		expect(curves).toHaveLength(1);
		expect(curves[0]?.limit).toBe(4);
		expect(curves[0]?.curve.at(-1)).toBe(0.5);
	});

	it("replays seats from the log instead of current registration times", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
			participationLimit: 2,
		});
		const promoted = await insertUser(t, "promoted@example.com");
		await insertRegistration(t, eventId, promoted._id, "registered", START - HOUR_MS);
		await t.run(async (ctx) => {
			const registration = { eventId, userId: promoted._id };
			await logRegistrationChange(ctx, registration, "registered", OPENS + 60_000);
			await logRegistrationChange(ctx, registration, "registered", START + HOUR_MS);
		});

		const [past] = await t.run((ctx) => pastCurvesBefore(ctx, START + DAY_MS));
		expect(past?.curve[PACE_GRID.indexOf(0.0002)]).toBe(0.5);
		expect(past?.curve.at(-1)).toBe(0.5);
	});
});

describe("baseline history coverage", () => {
	it("excludes empty and truncated event logs instead of learning false growth", async () => {
		const { t, companyId } = await setup();
		await insertEvent(t, companyId, { registrationOpens: OPENS, eventStart: START });
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: OPENS,
			eventStart: START,
		});
		const user = await insertUser(t, "busy-history@example.test");
		await t.run(async (ctx) => {
			for (let n = 0; n < 1001; n++)
				await ctx.db.insert("registrationLog", {
					eventId,
					userId: user._id,
					change: "registered",
					at: OPENS + n,
				});
		});
		expect(await t.run((ctx) => pastCurvesBefore(ctx, START + DAY_MS))).toEqual([]);
	});
});

describe("events without unregistration history", () => {
	it("stay out of the typical and company curves", async () => {
		const { t, companyId } = await setup();
		const untracked = UNREGISTRATION_HISTORY_START - DAY_MS;
		const old = await insertEvent(t, companyId, {
			registrationOpens: untracked,
			eventStart: untracked + 10 * DAY_MS,
		});
		await registerUsers(t, old, 3, untracked + HOUR_MS);
		const tracked = await insertEvent(t, companyId, {
			registrationOpens: UNREGISTRATION_HISTORY_START,
			eventStart: UNREGISTRATION_HISTORY_START + 10 * DAY_MS,
		});
		await registerUsers(t, tracked, 3, UNREGISTRATION_HISTORY_START + HOUR_MS);

		const past = await t.run((ctx) => pastCurvesBefore(ctx, START));
		const own = await t.run((ctx) => companyCurvesBefore(ctx, companyId, START));

		expect(past.map(({ eventId }) => eventId)).toEqual([tracked]);
		expect(own.map(({ eventId }) => eventId)).toEqual([tracked]);
	});
});

describe("companyCurvesBefore", () => {
	it("returns the company's most recent comparable events before the cutoff", async () => {
		const { t, companyId } = await setup();
		for (let index = 1; index <= 8; index += 1) await pastEvent(t, companyId, index * 20, index);
		await insertEvent(t, companyId, {
			eventStart: START - 10 * DAY_MS,
			registrationOpens: OPENS - 10 * DAY_MS,
			participationLimit: 10,
			published: false,
		});
		const other = await t.run(async (ctx) => {
			const company = await ctx.db.get(companyId);
			if (!company) throw new Error("Expected the company to exist.");
			const { _id, _creationTime, ...fields } = company;
			return ctx.db.insert("companies", { ...fields, name: "Annen" });
		});
		await pastEvent(t, other, 5, 10);

		const curves = await t.run((ctx) => companyCurvesBefore(ctx, companyId, START));
		expect(curves.map(({ curve }) => curve.at(-1))).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
	});
});

describe("baselineFor", () => {
	let next = 0;
	const past = (limit: number, curve: number[], eventId = `event${next++}`) => ({
		eventId: eventId as Id<"events">,
		limit,
		curve,
	});

	it("returns null when there are no past curves", () => {
		expect(baselineFor([], 10)).toBeNull();
	});

	it("excludes explicitly different reminder settings but retains unknown legacy settings", () => {
		const timeline = { registrationOpens: OPENS, eventStart: START, remindersEnabled: true };
		const legacy = {
			...past(10, PACE_GRID),
			timeline: { ...timeline, remindersEnabled: undefined },
		};
		const disabled = { ...past(10, PACE_GRID), timeline: { ...timeline, remindersEnabled: false } };
		expect(baselineFor([disabled], 10, [], timeline)).toBeNull();
		expect(baselineFor([legacy, disabled], 10, [], timeline)?.size).toBe(1);
	});

	it("caps the sample size", () => {
		const curves = Array.from({ length: 20 }, () => past(10, [0, 0.5, 1]));
		const baseline = baselineFor(curves, 10);
		expect(baseline?.size).toBe(12);
		expect(baseline?.curve.slice(0, 3)).toEqual([0, 0.5, 1]);
	});

	it("compares with past events of any size", () => {
		const baseline = baselineFor(
			[past(20, [0, 1]), past(200, [0, 0.1]), past(1000, [0, 0.03])],
			80,
		);
		expect(baseline?.size).toBe(3);
		expect(baseline?.curve[1]).toBeCloseTo(0.25);
	});

	it("weighs the company's own events against the pool by how many there are", () => {
		const pool = Array.from({ length: 5 }, () => past(10, [0, 0.2]));
		const baseline = baselineFor(pool, 10, [past(10, [0, 0.9]), past(10, [0, 1])]);
		expect(baseline?.size).toBe(7);
		expect(baseline?.curve[1]).toBeCloseTo(0.5 * 0.95 + 0.5 * 0.2);
	});

	it("expects the headcount of past events rather than their fill", () => {
		const soldOut = Array.from({ length: 3 }, () => past(40, [0, 0.5, 1]));
		expect(baselineFor(soldOut, 80)?.curve.slice(0, 3)).toEqual([0, 0.25, 0.5]);
	});

	it("caps the expected headcount at the seats of the event", () => {
		const larger = Array.from({ length: 3 }, () => past(60, [0, 0.5, 1]));
		expect(baselineFor(larger, 40)?.curve.slice(0, 3)).toEqual([0, 0.75, 1]);
	});

	it("lets a single earlier company event move the baseline", () => {
		const pool = Array.from({ length: 5 }, () => past(10, [0, 0.2]));
		const baseline = baselineFor(pool, 10, [past(10, [0, 1])]);
		expect(baseline?.size).toBe(6);
		expect(baseline?.curve[1]).toBeCloseTo(1 / 3 + (2 / 3) * 0.2);
	});

	it("keeps the company's own events out of the pool", () => {
		const own = past(10, [0, 1]);
		const baseline = baselineFor([own, past(10, [0, 0.2])], 10, [own]);
		expect(baseline?.size).toBe(2);
		expect(baseline?.curve[1]).toBeCloseTo(1 / 3 + (2 / 3) * 0.2);
	});

	it("uses the company alone when no other event exists", () => {
		const baseline = baselineFor([], 10, [past(10, [0, 1])]);
		expect(baseline?.size).toBe(1);
		expect(baseline?.curve.slice(0, 2)).toEqual([0, 1]);
	});
});

describe("snapshotOf", () => {
	it("composes registration counts, unregistrations, delta and status", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
			participationLimit: 4,
		});
		const now = OPENS + 2 * DAY_MS;

		const registeredUser = await insertUser(t, "snap1@example.com");
		await insertRegistration(t, eventId, registeredUser._id, "registered", OPENS + HOUR_MS);
		await t.run((ctx) =>
			logRegistrationChange(
				ctx,
				{ eventId, userId: registeredUser._id, status: "registered" },
				"registered",
				OPENS + HOUR_MS,
			),
		);

		const goneUser = await insertUser(t, "snap2@example.com");
		await t.run((ctx) =>
			logRegistrationChange(
				ctx,
				{ eventId, userId: goneUser._id, status: "registered" },
				"unregistered",
				now - 30 * 60_000,
			),
		);

		const event = await eventDoc(t, eventId);
		const snapshot = await t.run((ctx) => snapshotOf(ctx, event, now, []));

		expect(snapshot.registered).toBe(1);
		expect(snapshot.unregistrations).toHaveLength(1);
		expect(snapshot.delta24h).toBe(-1);
		expect(snapshot.baseline).toBeNull();
		expect(snapshot.expectedFillNow).toBeNull();
		expect(snapshot.status.kind).toBe("onPace");
	});

	it("uses the baseline to compute the expected fill and projection", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
			participationLimit: 10,
		});
		const now = OPENS + 5 * DAY_MS;
		await registerUsers(t, eventId, 5, OPENS + HOUR_MS);

		const event = await eventDoc(t, eventId);
		const baselineCurve = [...PACE_GRID];
		const snapshot = await t.run((ctx) =>
			snapshotOf(ctx, event, now, [{ eventId, limit: 10, curve: baselineCurve }]),
		);

		expect(snapshot.baseline?.curve).toEqual(baselineCurve);
		expect(snapshot.expectedFillNow).toBeCloseTo(0.5, 5);
		expect(snapshot.projectedFill).toBeCloseTo(1, 5);
	});

	it("builds the baseline from the hosting company's earlier events", async () => {
		const { t, companyId } = await setup();
		await pastEvent(t, companyId, 30, 9);
		await pastEvent(t, companyId, 60, 7);
		const eventId = await insertEvent(t, companyId, {
			eventStart: START,
			registrationOpens: OPENS,
			participationLimit: 10,
		});
		const event = await eventDoc(t, eventId);
		const pool = [{ eventId, limit: 10, curve: PACE_GRID.map(() => 0.1) }];

		const snapshot = await t.run((ctx) => snapshotOf(ctx, event, OPENS + DAY_MS, pool));
		expect(snapshot.baseline?.size).toBe(3);
		expect(snapshot.baseline?.curve.at(-1)).toBeCloseTo(0.5 * 0.8 + 0.5 * 0.1);
	});
});

describe("upcomingEvents", () => {
	it("returns only published, internal events from the given time, honoring the limit", async () => {
		const { t, companyId } = await setup();
		const now = OPENS;

		const first = await insertEvent(t, companyId, { eventStart: now + HOUR_MS });
		await insertEvent(t, companyId, { eventStart: now + 2 * HOUR_MS, published: false });
		const third = await insertEvent(t, companyId, {
			eventStart: now + 3 * HOUR_MS,
			externalEvent: true,
		});
		await insertEvent(t, companyId, { eventStart: now - HOUR_MS });

		const upcoming = await t.run((ctx) => upcomingEvents(ctx, now, 10));
		expect(upcoming.map((event) => event._id)).toEqual([first]);
		expect(upcoming.map((event) => event._id)).not.toContain(third);
	});

	it("scans past ineligible events until the limit of eligible events is reached", async () => {
		const { t, companyId } = await setup();
		const now = OPENS;
		await insertEvent(t, companyId, { eventStart: now + HOUR_MS, published: false });
		await insertEvent(t, companyId, { eventStart: now + 2 * HOUR_MS, participationLimit: 0 });
		const eligible = await insertEvent(t, companyId, { eventStart: now + 3 * HOUR_MS });
		await insertEvent(t, companyId, { eventStart: now + 4 * HOUR_MS });

		const limited = await t.run((ctx) => upcomingEvents(ctx, now, 1));
		expect(limited.map((event) => event._id)).toEqual([eligible]);
	});
});
