import { DAY_MS, HOUR_MS, MINUTE_MS } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import { insertEvent, insertUser, setup, type TestBackend } from "../../test/fixtures";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { CURVE_BACKFILL_BATCH, MAX_LOG_ENTRIES } from "./curves";
import { STATS_SWEEP_BATCH } from "./snapshot";

const LOG_ROWS = 3000;
const LONG_LOG_TIMEOUT_MS = MINUTE_MS;

async function endedEventWithLongLog(
	t: TestBackend,
	companyId: Id<"companies">,
	index: number,
	now: number,
	logRows = LOG_ROWS,
) {
	const eventStart = now - HOUR_MS;
	const registrationOpens = eventStart - 5 * DAY_MS;
	const eventId = await insertEvent(t, companyId, {
		eventStart,
		registrationOpens,
		participationLimit: 10,
		published: true,
		externalEvent: false,
	});
	const user = await insertUser(t, `logg${index}@example.com`);
	await t.run(async (ctx) => {
		for (let row = 0; row < logRows; row += 1) {
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: row % 2 === 0 ? "registered" : "unregistered",
				fromStatus: row % 2 === 0 ? undefined : "registered",
				at: registrationOpens + row * MINUTE_MS,
			});
		}
	});
}

async function seedEndedEvents(now: number) {
	const backend = await setup({ transactionLimits: true });
	for (let index = 0; index < STATS_SWEEP_BATCH; index += 1) {
		await endedEventWithLongLog(backend.t, backend.companyId, index, now);
	}
	return backend.t;
}

async function storedCurveCount(t: TestBackend) {
	return (await t.run((ctx) => ctx.db.query("eventCurves").collect())).length;
}

describe("stats batches under transaction limits", () => {
	it(
		"sweeps ended events with long logs and builds their curves separately",
		async () => {
			const t = await seedEndedEvents(Date.now());

			const pass = await t.mutation(internal.engagement.statsSweep.sweepStats, {});
			expect(pass).toMatchObject({ created: STATS_SWEEP_BATCH });
			await t.finishAllScheduledFunctions(() => {});

			expect(await storedCurveCount(t)).toBe(STATS_SWEEP_BATCH);
		},
		LONG_LOG_TIMEOUT_MS,
	);

	it(
		"repairs recent events with long logs",
		async () => {
			const now = Date.now();
			const t = await seedEndedEvents(now);

			const pass = await t.mutation(internal.engagement.statsSweep.repairRecentStats, { now });
			expect(pass).toMatchObject({ created: STATS_SWEEP_BATCH, finished: true });
			await t.finishAllScheduledFunctions(() => {});

			expect(await storedCurveCount(t)).toBe(STATS_SWEEP_BATCH);
		},
		LONG_LOG_TIMEOUT_MS,
	);

	it(
		"backfills a full batch of curves whose logs exceed the read cap",
		async () => {
			const now = Date.now();
			const { t, companyId } = await setup({ transactionLimits: true });
			for (let index = 0; index < CURVE_BACKFILL_BATCH; index += 1) {
				await endedEventWithLongLog(t, companyId, index, now, MAX_LOG_ENTRIES + 1);
			}

			const pass = await t.mutation(internal.engagement.curves.backfillCurves, { until: now });
			expect(pass).toEqual({ finished: true });

			expect(await storedCurveCount(t)).toBe(CURVE_BACKFILL_BATCH);
		},
		LONG_LOG_TIMEOUT_MS,
	);
});
