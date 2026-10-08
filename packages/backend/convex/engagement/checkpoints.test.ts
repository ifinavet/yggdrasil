import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import { baselineCutoffs } from "./checkpoints";
import { buildWorld, insightOutputs, NOW, normalised, type World } from "./insightWorld";
import { refreshEventStats } from "./stats";

afterEach(() => {
	vi.useRealTimers();
});

async function worldWithStats() {
	const world = await buildWorld();
	await world.t.run(async (ctx) => {
		for (const eventId of Object.values(world.events)) await refreshEventStats(ctx, eventId);
	});
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	return world;
}

async function semesterOf(world: World) {
	return normalised(world, (await insightOutputs(world)).semester);
}

async function checkpoints(world: World) {
	return await world.t.run((ctx) => ctx.db.query("eventCheckpoints").collect());
}

describe("baselineCutoffs", () => {
	it("keys both baselines to the start of the UTC day", () => {
		const morning = baselineCutoffs(Date.parse("2026-10-20T00:00:01Z"));
		const evening = baselineCutoffs(Date.parse("2026-10-20T23:59:59Z"));
		expect(evening).toEqual(morning);
		expect(baselineCutoffs(Date.parse("2026-10-21T00:00:01Z")).lastYear).toBe(
			morning.lastYear + 24 * 60 * 60 * 1000,
		);
	});
});

describe("buildCheckpoints", () => {
	it("builds the baseline rows once and leaves the semester output unchanged", async () => {
		const world = await worldWithStats();
		const before = await semesterOf(world);

		const first = await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		expect(first.built).toBeGreaterThan(0);
		expect(await checkpoints(world)).toHaveLength(first.built);
		expect(await semesterOf(world)).toEqual(before);

		const second = await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		expect(second).toEqual({ built: 0, pruned: 0 });
	});

	it("reads the baselines from the checkpoints instead of the registrations", async () => {
		const world = await worldWithStats();
		const before = await semesterOf(world);
		await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		await world.t.run(async (ctx) => {
			const events = await ctx.db.query("events").collect();
			const idsBefore = (limit: string, from = "2000-01-01T00:00:00Z") =>
				new Set(
					events
						.filter(
							({ eventStart }) => eventStart >= Date.parse(from) && eventStart < Date.parse(limit),
						)
						.map(({ _id }) => _id),
				);
			const registered = idsBefore("2026-07-01T00:00:00Z");
			const logged = idsBefore("2026-07-01T00:00:00Z", "2026-01-01T00:00:00Z");
			for (const row of await ctx.db.query("registrations").collect()) {
				if (registered.has(row.eventId)) await ctx.db.delete(row._id);
			}
			for (const row of await ctx.db.query("registrationLog").collect()) {
				if (logged.has(row.eventId)) await ctx.db.delete(row._id);
			}
		});
		expect(await semesterOf(world)).toEqual(before);
	});

	it("ignores a checkpoint whose event has since changed", async () => {
		const world = await worldWithStats();
		const before = await semesterOf(world);
		await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		await world.t.run(async (ctx) => {
			for (const row of await ctx.db.query("eventCheckpoints").collect()) {
				await ctx.db.patch(row._id, { participationLimit: row.participationLimit + 1 });
			}
		});
		expect(await semesterOf(world)).toEqual(before);
	});

	it("prunes checkpoints older than the retention window", async () => {
		const world = await worldWithStats();
		const { built } = await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		vi.setSystemTime(NOW + 4 * 24 * 60 * 60 * 1000);
		const later = await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		expect(later.pruned).toBe(built);
	});
});
