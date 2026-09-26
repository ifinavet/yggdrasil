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
import {
	baselineFor,
	logSince,
	pastCurvesBefore,
	registrationTimesOf,
	snapshotOf,
	upcomingEvents,
	waitlistCountOf,
} from "./snapshot";

const OPENS = Date.UTC(2026, 8, 1, 10);
const START = OPENS + 10 * DAY_MS;

async function registerUsers(t: TestBackend, eventId: Id<"events">, count: number, at: number) {
	for (let index = 0; index < count; index += 1) {
		const user = await insertUser(t, `bruker${eventId}-${index}@example.com`);
		await insertRegistration(t, eventId, user._id, "registered", at + index);
	}
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
});

describe("baselineFor", () => {
	it("returns null when there are no similarly sized past curves", async () => {
		expect(baselineFor([{ limit: 100, curve: [0, 1] }], 10)).toBeNull();
	});

	it("filters by similar capacity and caps the sample size", () => {
		const curves = Array.from({ length: 20 }, () => ({ limit: 10, curve: [0, 0.5, 1] }));
		const baseline = baselineFor([...curves, { limit: 1000, curve: [0, 1, 1] }], 10);
		expect(baseline?.size).toBe(12);
		expect(baseline?.curve.slice(0, 3)).toEqual([0, 0.5, 1]);
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
		const baselineCurve = Array.from({ length: 21 }, (_, step) => step / 20);
		const snapshot = await t.run((ctx) =>
			snapshotOf(ctx, event, now, [{ limit: 10, curve: baselineCurve }]),
		);

		expect(snapshot.baseline?.curve).toEqual(baselineCurve);
		expect(snapshot.expectedFillNow).toBeCloseTo(0.5, 5);
		expect(snapshot.projectedFill).toBeCloseTo(1, 5);
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

	it("applies the limit before filtering, so a low limit can exclude eligible events", async () => {
		const { t, companyId } = await setup();
		const now = OPENS;
		await insertEvent(t, companyId, { eventStart: now + HOUR_MS, published: false });
		const eligible = await insertEvent(t, companyId, { eventStart: now + 2 * HOUR_MS });

		const limited = await t.run((ctx) => upcomingEvents(ctx, now, 1));
		expect(limited).toHaveLength(0);

		const unlimited = await t.run((ctx) => upcomingEvents(ctx, now, 10));
		expect(unlimited.map((event) => event._id)).toEqual([eligible]);
	});
});
