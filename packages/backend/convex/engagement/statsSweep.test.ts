import { describe, expect, it } from "vitest";
import {
	DAY_IN_MS,
	insertEvent,
	insertRegistration,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { STATS_SWEEP_BATCH } from "./snapshot";

async function statsRows(t: TestBackend) {
	return await t.run((ctx) => ctx.db.query("eventStats").collect());
}

describe("sweepStats", () => {
	it("creates missing rows in batches and starts over after the last page", async () => {
		const { t, companyId } = await setup();
		const count = STATS_SWEEP_BATCH + 2;
		for (let i = 0; i < count; i++) {
			await insertEvent(t, companyId, { eventStart: Date.now() + (i + 1) * DAY_IN_MS });
		}
		const user = await insertUser(t, "student@example.com");
		const [first] = await t.run((ctx) => ctx.db.query("events").collect());
		await insertRegistration(t, first?._id as Doc<"events">["_id"], user._id, "registered");

		const firstPass = await t.mutation(internal.engagement.statsSweep.sweepStats, {});
		expect(firstPass).toMatchObject({ created: STATS_SWEEP_BATCH, finished: false });
		const secondPass = await t.mutation(internal.engagement.statsSweep.sweepStats, {});
		expect(secondPass).toMatchObject({ created: 2, finished: true });
		expect(await statsRows(t)).toHaveLength(count);
		expect((await statsRows(t)).find((row) => row.registered === 1)?.registrants).toEqual([
			user._id,
		]);

		const nextRound = await t.mutation(internal.engagement.statsSweep.sweepStats, {});
		expect(nextRound).toMatchObject({ created: 0, unchanged: STATS_SWEEP_BATCH, finished: false });
	});

	it("corrects a corrupted row", async () => {
		const { t, companyId } = await setup();
		const kept = await insertEvent(t, companyId);
		const user = await insertUser(t, "student@example.com");
		await insertRegistration(t, kept, user._id, "registered");
		await t.mutation(internal.engagement.statsSweep.sweepStats, {});
		await t.run(async (ctx) => {
			const row = await ctx.db
				.query("eventStats")
				.withIndex("by_eventId", (q) => q.eq("eventId", kept))
				.unique();
			await ctx.db.patch((row as Doc<"eventStats">)._id, { registered: 9, registrants: [] });
		});

		const pass = await t.mutation(internal.engagement.statsSweep.sweepStats, {});
		expect(pass).toMatchObject({ patched: 1, finished: true });
		const rows = await statsRows(t);
		expect(rows).toHaveLength(1);
		const corrected = rows.find((row) => row.eventId === kept);
		expect(corrected).toMatchObject({ registered: 1, registrants: [user._id] });
	});
});

describe("repairRecentStats", () => {
	it("refreshes events near their start and leaves distant ones alone", async () => {
		const { t, companyId } = await setup();
		const near = await insertEvent(t, companyId, { eventStart: Date.now() + DAY_IN_MS });
		await insertEvent(t, companyId, { eventStart: Date.now() + 400 * DAY_IN_MS });
		const user = await insertUser(t, "student@example.com");
		await insertRegistration(t, near, user._id, "registered");

		const result = await t.mutation(internal.engagement.statsSweep.repairRecentStats, {});
		expect(result).toMatchObject({ created: 1 });
		const rows = await statsRows(t);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ eventId: near, registered: 1 });
	});
});
