import { describe, expect, it } from "vitest";
import { buildWorld, NOW } from "../../test/insightWorld";
import type { Doc } from "../_generated/dataModel";
import { organizerRoleLoader } from "../events/helper";
import { companyLoader, companyWithLogo } from "../events/queries";
import { studentDirectory } from "./queries";
import { refreshEventStats, statsRowsBetween } from "./stats";

describe("studentDirectory", () => {
	it("looks up students that are missing from the preloaded directory", async () => {
		const world = await buildWorld();
		const found = await world.t.run(async (ctx) => {
			const directory = await studentDirectory(ctx, NOW);
			const userId = world.u.u13!;
			expect(directory.population.some((student) => student.userId === userId)).toBe(false);
			await ctx.db.insert("students", {
				userId,
				name: "Sen Student",
				studyProgram: "Informatikk",
				year: 1,
				degree: "Bachelor",
			});
			return await directory.studentsOf([{ userId }, { userId }]);
		});
		expect(found.map((student) => student.name)).toEqual(["Sen Student", "Sen Student"]);
	});
});

describe("studentDirectory population", () => {
	it("keeps current students when old alumni exceed the former cap", async () => {
		const world = await buildWorld();
		const result = await world.t.run(async (ctx) => {
			const userId = world.u.u13!;
			for (let i = 0; i < 5001; i++) {
				await ctx.db.insert("students", {
					userId,
					name: `Alumn ${i}`,
					studyProgram: "Informatikk",
					year: 5,
					degree: "Master",
					graduatedAt: NOW - 3000 * 24 * 60 * 60 * 1000,
				});
			}
			await ctx.db.insert("students", {
				userId: world.u.u1!,
				name: "Nyere Student",
				studyProgram: "Informatikk",
				year: 2,
				degree: "Bachelor",
			});
			const directory = await studentDirectory(ctx, NOW);
			const old = await directory.studentsOf([{ userId }]);
			return {
				names: directory.population.map((student) => student.name),
				old: old.length,
			};
		});
		expect(result.names).toContain("Nyere Student");
		expect(result.names).not.toContain("Alumn 0");
		expect(result.old).toBe(1);
	});
});

describe("companyLoader", () => {
	it("loads each company once and returns the same company data", async () => {
		const world = await buildWorld();
		await world.t.run(async (ctx) => {
			const load = companyLoader(ctx);
			const first = load(world.alpha);
			expect(load(world.alpha)).toBe(first);
			expect(await first).toEqual(await companyWithLogo(ctx, world.alpha));
			expect(await load(world.beta)).toEqual(await companyWithLogo(ctx, world.beta));
		});
	});
});

describe("organizerRoleLoader", () => {
	it("resolves the leading role per event and null where the user does not organize", async () => {
		const world = await buildWorld();
		const roles = await world.t.run(async (ctx) => {
			const userId = world.u.u1!;
			await ctx.db.insert("eventOrganizers", {
				eventId: world.events.a1,
				userId,
				role: "medhjelper",
			});
			await ctx.db.insert("eventOrganizers", {
				eventId: world.events.a1,
				userId,
				role: "hovedansvarlig",
			});
			await ctx.db.insert("eventOrganizers", {
				eventId: world.events.a2,
				userId,
				role: "medhjelper",
			});
			const roleOf = organizerRoleLoader(ctx, userId);
			return await Promise.all([
				roleOf(world.events.a1),
				roleOf(world.events.a2),
				roleOf(world.events.b1),
			]);
		});
		expect(roles).toEqual(["hovedansvarlig", "medhjelper", null]);
	});
});

describe("statsRowsBetween", () => {
	it("keys the stored stats of the events starting in the range by event", async () => {
		const world = await buildWorld();
		const keys = await world.t.run(async (ctx) => {
			for (const eventId of Object.values(world.events)) await refreshEventStats(ctx, eventId);
			const a1 = (await ctx.db.get(world.events.a1)) as Doc<"events">;
			const rows = await statsRowsBetween(ctx, a1.eventStart, a1.eventStart + 1);
			return [...rows.entries()].map(([eventId, row]) => [eventId, row.eventId]);
		});
		expect(keys).toEqual([[world.events.a1, world.events.a1]]);
	});
});
