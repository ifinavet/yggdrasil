import { DAY_MS, HOUR_MS } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	insertEvent,
	insertRegistration,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { CURVE_BACKFILL_STALE_MS, curveOf, refreshEventCurve } from "./curves";
import { logRegistrationChange } from "./log";

const OPENS = Date.UTC(2026, 1, 1, 10);
const START = OPENS + 10 * DAY_MS;
const AFTER = START + DAY_MS;

afterEach(() => {
	vi.useRealTimers();
});

async function pastEventWithSeats(t: TestBackend, companyId: Id<"companies">, seats: number) {
	const eventId = await insertEvent(t, companyId, {
		eventStart: START,
		registrationOpens: OPENS,
		participationLimit: 10,
		published: true,
		externalEvent: false,
	});
	for (let index = 0; index < seats; index += 1) {
		const user = await insertUser(t, `kurve${index}@example.com`);
		await insertRegistration(t, eventId, user._id, "registered", OPENS + HOUR_MS);
		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: user._id }, "registered", OPENS + HOUR_MS),
		);
	}
	return eventId;
}

async function storedCurves(t: TestBackend) {
	return await t.run((ctx) => ctx.db.query("eventCurves").collect());
}

async function refresh(t: TestBackend, eventId: Id<"events">, now: number) {
	await t.run(async (ctx) => {
		const event = await ctx.db.get(eventId);
		if (event) await refreshEventCurve(ctx, event, now);
	});
}

describe("refreshEventCurve", () => {
	it("stores the curve of a past event and serves it unchanged", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventWithSeats(t, companyId, 4);

		const computed = await t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			return event && (await curveOf(ctx, event));
		});
		await refresh(t, eventId, AFTER);
		const stored = await t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			return event && (await curveOf(ctx, event));
		});

		expect(await storedCurves(t)).toHaveLength(1);
		expect(stored).toEqual(computed);
		expect(stored?.curve.at(-1)).toBeCloseTo(0.4);
	});

	it("ignores a stored curve after the event changes", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventWithSeats(t, companyId, 4);
		await refresh(t, eventId, AFTER);
		await t.run((ctx) => ctx.db.patch(eventId, { participationLimit: 4 }));

		const curve = await t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			return event && (await curveOf(ctx, event));
		});

		expect(curve?.limit).toBe(4);
		expect(curve?.curve.at(-1)).toBeCloseTo(1);
	});

	it("keeps no curve for events that have not started", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventWithSeats(t, companyId, 2);
		await refresh(t, eventId, AFTER);
		await refresh(t, eventId, START - DAY_MS);

		expect(await storedCurves(t)).toHaveLength(0);
	});
});

describe("backfillCurves", () => {
	it("stores curves for past events once and then stops", async () => {
		const { t, companyId } = await setup();
		await pastEventWithSeats(t, companyId, 3);

		await t.mutation(internal.engagement.curves.backfillCurves, {});
		await t.finishAllScheduledFunctions(() => {});
		const first = await storedCurves(t);
		await t.run(async (ctx) => {
			for (const row of first) await ctx.db.delete(row._id);
		});
		const second = await t.mutation(internal.engagement.curves.backfillCurves, {});

		expect(first).toHaveLength(1);
		expect(second).toEqual({ finished: true });
		expect(await storedCurves(t)).toHaveLength(0);
	});

	it("does not start a second run while one is in progress", async () => {
		const { t, companyId } = await setup();
		await pastEventWithSeats(t, companyId, 3);
		await t.run((ctx) => ctx.db.insert("curveBackfill", { done: false }));

		const result = await t.mutation(internal.engagement.curves.backfillCurves, {});

		expect(result).toEqual({ finished: false });
		expect(await storedCurves(t)).toHaveLength(0);
	});

	it("restarts a run that stopped without finishing", async () => {
		const { t, companyId } = await setup();
		await pastEventWithSeats(t, companyId, 3);
		await t.run((ctx) => ctx.db.insert("curveBackfill", { done: false }));
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.now() + CURVE_BACKFILL_STALE_MS + 1);

		const result = await t.mutation(internal.engagement.curves.backfillCurves, {});

		expect(result).toEqual({ finished: true });
		expect(await storedCurves(t)).toHaveLength(1);
	});
});
