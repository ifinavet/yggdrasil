import { eventSemesterRange } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWorld, insightOutputs, NOW, normalised, type World } from "../../test/insightWorld";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { baselineCutoffs, baselineStatsAt } from "./checkpoints";
import { computeEventStats, refreshEventStats } from "./stats";

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
	it("keys the checkpoints to the start of the UTC day and keeps the exact cutoffs", () => {
		const morning = baselineCutoffs(Date.parse("2026-10-20T00:00:01Z"));
		const evening = baselineCutoffs(Date.parse("2026-10-20T23:59:59Z"));
		expect(evening.previousCheckpoint).toBe(morning.previousCheckpoint);
		expect(evening.lastYearCheckpoint).toBe(morning.lastYearCheckpoint);
		expect(evening.lastYear).toBe(Date.parse("2025-10-20T23:59:59Z"));
		expect(morning.lastYear).toBe(Date.parse("2025-10-20T00:00:01Z"));
		expect(evening.previousCutoff - morning.previousCutoff).toBe(
			Date.parse("2026-10-20T23:59:59Z") - Date.parse("2026-10-20T00:00:01Z"),
		);
		expect(baselineCutoffs(Date.parse("2026-10-21T00:00:01Z")).lastYearCheckpoint).toBe(
			morning.lastYearCheckpoint + 24 * 60 * 60 * 1000,
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

describe("baselines between the checkpoint and the exact cutoff", () => {
	it("matches the raw numbers when the registrations changed during the day", async () => {
		const world = await worldWithStats();
		const { previousCutoff, previousCheckpoint } = baselineCutoffs(NOW);
		const hour = 60 * 60 * 1000;
		expect(previousCutoff - previousCheckpoint).toBeGreaterThan(2 * hour);
		let eventId = "" as Id<"events">;
		await world.t.run(async (ctx) => {
			const range = eventSemesterRange("vår", 2026);
			const events = await ctx.db.query("events").collect();
			const event = events.find(
				(candidate) =>
					candidate.published &&
					!candidate.externalEvent &&
					candidate.participationLimit > 0 &&
					candidate.eventStart >= range.start &&
					candidate.eventStart < range.end &&
					candidate.registrationOpens <= previousCheckpoint,
			);
			if (!event) throw new Error("no event in the previous semester");
			eventId = event._id;
			const users = await ctx.db.query("users").take(3);
			const gap = users[1];
			const later = users[2];
			if (!gap || !later) throw new Error("not enough users");
			const entries = [
				{ user: gap, at: previousCutoff - hour },
				{ user: later, at: previousCutoff + hour },
			];
			for (const { user, at } of entries) {
				await ctx.db.insert("registrations", {
					eventId: event._id,
					userId: user._id,
					status: "registered",
					registrationTime: at,
				});
				await ctx.db.insert("registrationLog", {
					eventId: event._id,
					userId: user._id,
					change: "registered",
					at,
				});
			}
			await refreshEventStats(ctx, event._id);
		});
		await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		const { served, raw, checkpointed } = await world.t.run(async (ctx) => {
			const event = (await ctx.db.get(eventId)) as Doc<"events">;
			const rows = await ctx.db
				.query("eventCheckpoints")
				.withIndex("by_eventId_and_cutoff", (q) => q.eq("eventId", eventId))
				.collect();
			return {
				checkpointed: rows.length,
				served: await baselineStatsAt(ctx, event, previousCutoff, previousCheckpoint),
				raw: await computeEventStats(ctx, event, previousCutoff),
			};
		});
		expect(checkpointed).toBe(1);
		expect(served).toEqual(raw);
	});
});
