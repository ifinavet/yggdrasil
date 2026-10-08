import { DAY_MS, HOUR_MS } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertStudent,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import * as stats from "./stats";

vi.mock("./stats", async (importOriginal) => {
	const original = await importOriginal<typeof import("./stats")>();
	return { ...original, refreshEventStats: vi.fn(original.refreshEventStats) };
});

afterEach(() => {
	vi.useRealTimers();
	vi.mocked(stats.refreshEventStats).mockClear();
});

async function rowOf(t: TestBackend, eventId: Id<"events">) {
	return await t.run((ctx) => stats.statsRowOf(ctx, eventId));
}

async function refresh(t: TestBackend, eventId: Id<"events">) {
	await t.run((ctx) => stats.refreshEventStats(ctx, eventId));
	vi.mocked(stats.refreshEventStats).mockClear();
}

describe("refreshing once per touched event", () => {
	it("refreshes an event once when the waitlist is cleared", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10, eventStart: now });
		for (const [index, status] of (["pending", "waitlist", "waitlist"] as const).entries()) {
			const user = await insertUser(t, `u${index}@example.com`);
			await insertRegistration(t, eventId, user._id, status, now + index);
		}
		vi.mocked(stats.refreshEventStats).mockClear();

		await t.mutation(internal.events.waitlist.mutations.clearWaitlistAndPending, {});

		expect(vi.mocked(stats.refreshEventStats)).toHaveBeenCalledTimes(1);
		expect(await rowOf(t, eventId)).toMatchObject({ pending: 0, waitlist: 0 });
	});

	it("refreshes an event once when several offers expire and the seats are refilled", async () => {
		const { t, companyId } = await setup();
		const now = Date.now();
		const eventId = await insertEvent(t, companyId, { participationLimit: 3 });
		for (let index = 0; index < 3; index++) {
			const user = await insertUser(t, `p${index}@example.com`);
			await insertRegistration(t, eventId, user._id, "pending", now - 30 * HOUR_MS + index);
		}
		for (let index = 0; index < 3; index++) {
			const user = await insertUser(t, `w${index}@example.com`);
			await insertRegistration(t, eventId, user._id, "waitlist", now - 10 * HOUR_MS + index);
		}
		vi.mocked(stats.refreshEventStats).mockClear();

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		expect(vi.mocked(stats.refreshEventStats)).toHaveBeenCalledTimes(1);
	});
});

describe("check-in", () => {
	async function checkInWorld() {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 5 });
		const organizer = await insertUser(t, "arrangor@example.com");
		await insertOrganizer(t, eventId, organizer._id);
		const ids: Id<"registrations">[] = [];
		for (const name of ["a", "b"]) {
			const user = await insertUser(t, `${name}@example.com`);
			await insertStudent(t, user._id);
			ids.push(await insertRegistration(t, eventId, user._id, "registered"));
		}
		await refresh(t, eventId);
		return { t, eventId, ids, organizer };
	}

	it("patches the attendance counters without recomputing the event", async () => {
		const { t, eventId, ids, organizer } = await checkInWorld();
		await t.run(async (ctx) => {
			const row = (await stats.statsRowOf(ctx, eventId)) as Doc<"eventStats">;
			await ctx.db.patch(row._id, { waitlist: 99 });
		});

		await asUser(t, organizer).mutation(api.events.registrations.mutations.updateAttendance, {
			id: ids[0] as Id<"registrations">,
			newStatus: "confirmed",
		});
		await asUser(t, organizer).mutation(api.events.registrations.mutations.updateAttendance, {
			id: ids[0] as Id<"registrations">,
			newStatus: "no_show",
		});

		expect(vi.mocked(stats.refreshEventStats)).not.toHaveBeenCalled();
		expect(await rowOf(t, eventId)).toMatchObject({
			waitlist: 99,
			attendanceRecorded: true,
			showedUp: 0,
			noShows: 1,
		});
	});

	it("drops the checkpoints of the event so the baselines are recomputed", async () => {
		const { t, eventId, ids, organizer } = await checkInWorld();
		const base = await rowOf(t, eventId);
		await t.run((ctx) => {
			const { _id, _creationTime, ...numbers } = base as Doc<"eventStats">;
			return ctx.db.insert("eventCheckpoints", { ...numbers, cutoff: 1 });
		});

		await asUser(t, organizer).mutation(api.events.registrations.mutations.updateAttendance, {
			id: ids[1] as Id<"registrations">,
			newStatus: "late",
		});

		expect(await t.run((ctx) => ctx.db.query("eventCheckpoints").collect())).toHaveLength(0);
	});
});

describe("unregistration import", () => {
	it("refreshes the stats of the events it adds log rows to", async () => {
		const { t, companyId } = await setup();
		const opens = Date.now() - 30 * DAY_MS;
		const start = Date.now() - 10 * DAY_MS;
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: opens,
			eventStart: start,
			participationLimit: 2,
		});
		const user = await insertUser(t, "ada@example.com");
		await refresh(t, eventId);
		vi.useFakeTimers();

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [
				{
					eventId,
					userId: user._id,
					status: "registered",
					registrationTime: opens + HOUR_MS,
					at: start - HOUR_MS,
				},
			],
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await rowOf(t, eventId)).toMatchObject({ lateUnregistrations: 1, registered: 0 });
	});
});

describe("refreshEventStats", () => {
	it("removes the stored row when the history is too large to compute", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId);
		const user = await insertUser(t, "ada@example.com");
		await insertRegistration(t, eventId, user._id, "registered");
		await refresh(t, eventId);
		expect(await rowOf(t, eventId)).not.toBeNull();
		await t.run(async (ctx) => {
			for (let index = 0; index < 4001; index++) {
				await ctx.db.insert("registrationLog", {
					eventId,
					userId: user._id,
					change: "registered",
					at: index,
				});
			}
		});

		const outcome = await t.run((ctx) => stats.refreshEventStats(ctx, eventId));

		expect(outcome).toBe("removed");
		expect(await rowOf(t, eventId)).toBeNull();
	});
});

describe("repairRecentStats", () => {
	it("reaches every event in the window across pages", async () => {
		const { t, companyId } = await setup();
		const ids: Id<"events">[] = [];
		for (let index = 0; index < 65; index++) {
			ids.push(await insertEvent(t, companyId, { eventStart: Date.now() + HOUR_MS * (index + 1) }));
		}

		vi.useFakeTimers();
		await t.mutation(internal.engagement.statsSweep.repairRecentStats, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const rows = await t.run((ctx) => ctx.db.query("eventStats").collect());
		expect(new Set(rows.map(({ eventId }) => eventId))).toEqual(new Set(ids));
	});
});
