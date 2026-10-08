import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWorld, insightOutputs, normalised, type World } from "./insightWorld";
import { refreshEventStats } from "./stats";

afterEach(() => {
	vi.useRealTimers();
});

async function backfill(world: World) {
	await world.t.run(async (ctx) => {
		for (const eventId of Object.values(world.events)) await refreshEventStats(ctx, eventId);
	});
}

describe("insight outputs on a seeded world", () => {
	it("returns the recorded semester, past, history, detail, list and foods output", async () => {
		const world = await buildWorld();
		expect(normalised(world, await insightOutputs(world))).toMatchSnapshot();
	});

	it("returns the recorded output after the stats rows are backfilled", async () => {
		const world = await buildWorld();
		await backfill(world);
		const rows = await world.t.run(
			async (ctx) => (await ctx.db.query("eventStats").collect()).length,
		);
		expect(rows).toBe(Object.keys(world.events).length);
		expect(normalised(world, await insightOutputs(world))).toMatchSnapshot("recorded");
	});

	it("reads the stored rows without touching registrations", async () => {
		const world = await buildWorld();
		await backfill(world);
		const before = await insightOutputs(world);
		await world.t.run(async (ctx) => {
			for (const row of await ctx.db.query("registrations").collect()) await ctx.db.delete(row._id);
		});
		const after = await insightOutputs(world);
		expect(normalised(world, after)).toEqual(normalised(world, before));
	});
});
