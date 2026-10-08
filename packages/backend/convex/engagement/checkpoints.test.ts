import { eventSemesterRange } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertEvent } from "../../test/fixtures";
import { buildWorld, insightOutputs, NOW, normalised, type World } from "../../test/insightWorld";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { baselineCutoffs, baselineRowsAt, baselineStatsAt } from "./checkpoints";
import { MAX_TOUCHED_ROWS } from "./snapshot";
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
	it("keys the checkpoints to the start of the hour and keeps the exact cutoffs", () => {
		const early = baselineCutoffs(Date.parse("2026-10-20T10:00:01Z"));
		const late = baselineCutoffs(Date.parse("2026-10-20T10:59:59Z"));
		expect(late.previousCheckpoint).toBe(early.previousCheckpoint);
		expect(late.lastYearCheckpoint).toBe(early.lastYearCheckpoint);
		expect(late.lastYear).toBe(Date.parse("2025-10-20T10:59:59Z"));
		expect(early.lastYear).toBe(Date.parse("2025-10-20T10:00:01Z"));
		expect(late.previousCutoff - late.previousCheckpoint).toBe(59 * 60 * 1000 + 59 * 1000);
		expect(baselineCutoffs(Date.parse("2026-10-20T11:00:01Z")).lastYearCheckpoint).toBe(
			early.lastYearCheckpoint + 60 * 60 * 1000,
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
	it("matches the raw numbers when the registrations changed during the hour", async () => {
		const world = await worldWithStats();
		const minutes = 60 * 1000;
		const now = NOW + 40 * minutes;
		const { previousCutoff, previousCheckpoint } = baselineCutoffs(now);
		expect(previousCutoff - previousCheckpoint).toBe(40 * minutes);
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
				{ user: gap, at: previousCutoff - 20 * minutes },
				{ user: later, at: previousCutoff + 20 * minutes },
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
		vi.setSystemTime(now);
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

async function previousSemesterEvent(world: World, registrationOpens: number) {
	const range = eventSemesterRange("vår", 2026);
	return await insertEvent(world.t, world.alpha, {
		title: "Sen",
		participationLimit: 10,
		registrationOpens,
		eventStart: range.end - 24 * 60 * 60 * 1000,
	});
}

describe("checkpoints for events that open during the hour", () => {
	it("builds a checkpoint ahead of the opening and serves it once the cutoff passes it", async () => {
		const world = await worldWithStats();
		const minutes = 60 * 1000;
		const { previousCheckpoint } = baselineCutoffs(NOW);
		const eventId = await previousSemesterEvent(world, previousCheckpoint + 20 * minutes);
		await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		const later = baselineCutoffs(NOW + 40 * minutes);
		expect(later.previousCheckpoint).toBe(previousCheckpoint);
		const { stored, served, raw } = await world.t.run(async (ctx) => {
			const event = (await ctx.db.get(eventId)) as Doc<"events">;
			return {
				stored: await ctx.db
					.query("eventCheckpoints")
					.withIndex("by_eventId_and_cutoff", (q) =>
						q.eq("eventId", eventId).eq("cutoff", previousCheckpoint),
					)
					.collect(),
				served: await baselineStatsAt(ctx, event, later.previousCutoff, previousCheckpoint),
				raw: await computeEventStats(ctx, event, later.previousCutoff),
			};
		});
		expect(stored).toHaveLength(1);
		expect(served).toEqual(raw);
	});
});

describe("baselineRowsAt", () => {
	it("falls back to per event checks when too many rows changed since the checkpoint", async () => {
		const world = await worldWithStats();
		const minutes = 60 * 1000;
		const now = NOW + 40 * minutes;
		const { previousCutoff, previousCheckpoint } = baselineCutoffs(now);
		const eventId = await previousSemesterEvent(world, previousCheckpoint - 60 * minutes);
		vi.setSystemTime(now);
		await world.t.mutation(internal.engagement.checkpoints.buildCheckpoints, {});
		const { touched, preloaded, raw } = await world.t.run(async (ctx) => {
			for (let index = 0; index <= MAX_TOUCHED_ROWS; index += 1) {
				await ctx.db.insert("registrationLog", {
					eventId: world.events.a1,
					userId: world.u.u1!,
					change: "registered",
					at: previousCheckpoint + 1 + index,
				});
			}
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: world.u.u2!,
				change: "registered",
				at: previousCutoff - minutes,
			});
			const event = (await ctx.db.get(eventId)) as Doc<"events">;
			const rows = await baselineRowsAt(ctx, previousCutoff, previousCheckpoint);
			return {
				touched: rows.touched,
				preloaded: await baselineStatsAt(ctx, event, previousCutoff, previousCheckpoint, {
					...rows,
					stored: null,
				}),
				raw: await computeEventStats(ctx, event, previousCutoff),
			};
		});
		expect(touched).toBeNull();
		expect(preloaded).toEqual(raw);
		expect(preloaded.registered).toBe(1);
	});
});
