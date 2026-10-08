import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertStudent,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { RegistrationChange } from "./schema";
import { refreshEventStats } from "./stats";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00Z");

afterEach(() => {
	vi.useRealTimers();
});

type Attendance = NonNullable<Doc<"registrations">["attendanceStatus"]>;

async function act(
	t: TestBackend,
	eventId: Id<"events">,
	userId: Id<"users">,
	change: RegistrationChange,
	time: string,
	attendance?: Attendance,
) {
	const when = at(time);
	await t.run(async (ctx) => {
		const current = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect();
		const row = current.find((registration) => registration.userId === userId);
		const log = (fromStatus?: Doc<"registrations">["status"]) =>
			ctx.db.insert("registrationLog", { eventId, userId, change, fromStatus, at: when });
		if (change === "registered" || change === "waitlisted") {
			await ctx.db.insert("registrations", {
				eventId,
				userId,
				status: change === "registered" ? "registered" : "waitlist",
				registrationTime: when,
				attendanceStatus: attendance,
			});
			await log();
			return;
		}
		if (!row) throw new Error("No registration to change");
		if (change === "unregistered" || change === "cleared") {
			await ctx.db.delete(row._id);
		} else {
			const status =
				change === "offered" ? "pending" : change === "accepted" ? "registered" : "waitlist";
			await ctx.db.patch(row._id, { status, registrationTime: when });
		}
		await log(row.status);
	});
}

async function attend(
	t: TestBackend,
	eventId: Id<"events">,
	userId: Id<"users">,
	status: Attendance,
) {
	await t.run(async (ctx) => {
		const rows = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect();
		const row = rows.find((registration) => registration.userId === userId);
		if (row) await ctx.db.patch(row._id, { attendanceStatus: status });
	});
}

export async function buildWorld() {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(at("2025-03-01T00:00:00Z"));
	const { t, companyId: alpha } = await setup();
	const company = (await t.run((ctx) => ctx.db.get(alpha))) as Doc<"companies">;
	const { _id, _creationTime, ...fields } = company;
	const beta = await t.run((ctx) =>
		ctx.db.insert("companies", { ...fields, orgNumber: 111111111, name: "Beta" }),
	);
	const gamma = await t.run((ctx) =>
		ctx.db.insert("companies", { ...fields, orgNumber: 222222222, name: "Gamma" }),
	);

	const intern = await insertUser(t, "intern@example.com");
	await grantRole(t, intern._id, "internal");

	const profiles: Array<[string, Partial<Doc<"students">>?]> = [
		["u1", { degree: "Bachelor", year: 2 }],
		["u2", { degree: "Bachelor", year: 3, studyProgram: "Design" }],
		["u3", { degree: "Master", year: 4 }],
		["u4", { degree: "Bachelor", year: 1 }],
		["u5", { degree: "Bachelor", year: 2, studyProgram: "Design" }],
		["u6", { degree: "Master", year: 5 }],
		["u7", { degree: "Årsstudium", year: 1 }],
		["u8", { degree: "PhD", year: 1 }],
		["u9", { degree: "Bachelor", year: 3 }],
		["u10", { degree: "Master", year: 5, graduatedAt: at("2026-06-01T00:00:00Z") }],
		["u11", { degree: "Bachelor", year: 2 }],
		["u12", { degree: "Bachelor", year: 1 }],
		["u13"],
	];
	const u: Record<string, Id<"users">> = {};
	for (const [name, profile] of profiles) {
		const user = await insertUser(t, `${name}@example.com`);
		u[name] = user._id;
		if (profile) await insertStudent(t, user._id, profile);
	}

	const event = (company: Id<"companies">, title: string, overrides: Partial<Doc<"events">>) =>
		insertEvent(t, company, { title, ...overrides });

	const a1 = await event(alpha, "A1", {
		participationLimit: 3,
		registrationOpens: at("2026-09-20T10:00:00Z"),
		eventStart: at("2026-10-06T16:00:00Z"),
	});
	await act(t, a1, u.u1!, "registered", "2026-09-21T09:00:00Z");
	await act(t, a1, u.u2!, "registered", "2026-09-21T10:00:00Z");
	await act(t, a1, u.u5!, "registered", "2026-09-22T10:00:00Z");
	await act(t, a1, u.u4!, "waitlisted", "2026-09-22T11:00:00Z");
	await act(t, a1, u.u3!, "registered", "2026-09-23T10:00:00Z").catch(() => undefined);
	await act(t, a1, u.u5!, "unregistered", "2026-10-06T08:00:00Z");
	await act(t, a1, u.u4!, "offered", "2026-10-06T08:01:00Z");
	await act(t, a1, u.u4!, "accepted", "2026-10-06T09:00:00Z");
	await attend(t, a1, u.u1!, "confirmed");
	await attend(t, a1, u.u2!, "late");
	await attend(t, a1, u.u4!, "no_show");

	const a2 = await event(alpha, "A2", {
		participationLimit: 2,
		registrationOpens: at("2026-09-01T10:00:00Z"),
		eventStart: at("2026-09-15T16:00:00Z"),
	});
	await act(t, a2, u.u6!, "registered", "2026-09-02T10:00:00Z");
	await act(t, a2, u.u7!, "registered", "2026-09-02T11:00:00Z");
	await act(t, a2, u.u9!, "waitlisted", "2026-09-03T11:00:00Z");
	await act(t, a2, u.u7!, "unregistered", "2026-09-10T11:00:00Z");
	await act(t, a2, u.u9!, "offered", "2026-09-10T11:01:00Z");
	await act(t, a2, u.u9!, "expired", "2026-09-12T11:01:00Z");
	await act(t, a2, u.u9!, "offered", "2026-09-12T11:02:00Z");
	await act(t, a2, u.u9!, "accepted", "2026-09-12T12:00:00Z");
	await attend(t, a2, u.u6!, "confirmed");
	await attend(t, a2, u.u9!, "confirmed");

	const b1 = await event(beta, "B1", {
		participationLimit: 4,
		registrationOpens: at("2026-10-01T10:00:00Z"),
		eventStart: at("2026-10-14T16:00:00Z"),
	});
	await act(t, b1, u.u1!, "registered", "2026-10-02T10:00:00Z");
	await act(t, b1, u.u9!, "registered", "2026-10-02T11:00:00Z");
	await act(t, b1, u.u10!, "registered", "2026-10-03T11:00:00Z");
	await act(t, b1, u.u11!, "waitlisted", "2026-10-04T11:00:00Z");
	await act(t, b1, u.u13!, "registered", "2026-10-04T12:00:00Z");

	const b2 = await event(beta, "B2", {
		participationLimit: 2,
		registrationOpens: at("2026-10-10T10:00:00Z"),
		eventStart: at("2026-11-05T16:00:00Z"),
	});
	await act(t, b2, u.u2!, "registered", "2026-10-11T10:00:00Z");
	await act(t, b2, u.u3!, "registered", "2026-10-11T11:00:00Z");
	await act(t, b2, u.u12!, "waitlisted", "2026-10-12T11:00:00Z");
	await act(t, b2, u.u11!, "waitlisted", "2026-10-12T12:00:00Z");
	await act(t, b2, u.u3!, "unregistered", "2026-10-15T11:00:00Z");
	await act(t, b2, u.u12!, "offered", "2026-10-15T11:01:00Z");

	await event(gamma, "C1 not open", {
		participationLimit: 5,
		registrationOpens: at("2026-10-25T10:00:00Z"),
		eventStart: at("2026-12-01T16:00:00Z"),
	});
	await event(gamma, "Hidden", {
		published: false,
		registrationOpens: at("2026-10-01T10:00:00Z"),
		eventStart: at("2026-10-30T16:00:00Z"),
	});
	await event(gamma, "External", {
		externalEvent: true,
		registrationOpens: at("2026-10-01T10:00:00Z"),
		eventStart: at("2026-10-30T16:00:00Z"),
	});

	const a3 = await event(alpha, "A3", {
		participationLimit: 3,
		registrationOpens: at("2026-02-01T10:00:00Z"),
		eventStart: at("2026-03-10T16:00:00Z"),
	});
	await act(t, a3, u.u1!, "registered", "2026-02-05T10:00:00Z");
	await act(t, a3, u.u2!, "registered", "2026-02-06T10:00:00Z");
	await act(t, a3, u.u9!, "registered", "2026-02-07T10:00:00Z");
	await act(t, a3, u.u9!, "unregistered", "2026-03-09T20:00:00Z");
	await act(t, a3, u.u4!, "registered", "2026-03-09T21:00:00Z");
	await attend(t, a3, u.u1!, "confirmed");
	await attend(t, a3, u.u4!, "no_show");

	const b3 = await event(beta, "B3", {
		participationLimit: 2,
		registrationOpens: at("2026-03-01T10:00:00Z"),
		eventStart: at("2026-04-20T16:00:00Z"),
	});
	await act(t, b3, u.u4!, "registered", "2026-03-05T10:00:00Z");
	await act(t, b3, u.u5!, "registered", "2026-03-10T10:00:00Z");
	await act(t, b3, u.u6!, "waitlisted", "2026-03-12T10:00:00Z");
	await act(t, b3, u.u4!, "unregistered", "2026-04-10T10:00:00Z");
	await act(t, b3, u.u6!, "offered", "2026-04-10T10:01:00Z");
	await act(t, b3, u.u6!, "accepted", "2026-04-11T10:01:00Z");
	await act(t, b3, u.u7!, "registered", "2026-04-12T10:01:00Z").catch(() => undefined);

	const c2 = await event(gamma, "C2", {
		participationLimit: 3,
		registrationOpens: at("2026-04-25T10:00:00Z"),
		eventStart: at("2026-05-12T16:00:00Z"),
	});
	await act(t, c2, u.u1!, "registered", "2026-04-26T10:00:00Z");
	await act(t, c2, u.u3!, "registered", "2026-04-26T11:00:00Z");

	const a4 = await event(alpha, "A4", {
		participationLimit: 2,
		registrationOpens: at("2025-09-20T10:00:00Z"),
		eventStart: at("2025-10-02T16:00:00Z"),
	});
	await act(t, a4, u.u1!, "registered", "2025-09-21T10:00:00Z");
	await act(t, a4, u.u2!, "registered", "2025-09-21T11:00:00Z");
	await act(t, a4, u.u2!, "unregistered", "2025-10-02T10:00:00Z");
	await attend(t, a4, u.u1!, "late");

	const b4 = await event(beta, "B4", {
		participationLimit: 2,
		registrationOpens: at("2025-10-10T10:00:00Z"),
		eventStart: at("2025-11-15T16:00:00Z"),
	});
	await act(t, b4, u.u3!, "registered", "2025-10-11T10:00:00Z");
	await act(t, b4, u.u5!, "registered", "2025-10-12T10:00:00Z");
	await act(t, b4, u.u5!, "unregistered", "2025-11-15T10:00:00Z");

	const a5 = await event(alpha, "A5", {
		participationLimit: 2,
		registrationOpens: at("2025-02-01T10:00:00Z"),
		eventStart: at("2025-02-20T16:00:00Z"),
	});
	await t.run(async (ctx) => {
		for (const user of [u.u1!, u.u2!, u.u3!]) {
			await ctx.db.insert("registrations", {
				eventId: a5,
				userId: user,
				status: user === u.u3 ? "waitlist" : "registered",
				registrationTime: at("2025-02-05T10:00:00Z"),
				attendanceStatus: user === u.u1 ? "confirmed" : undefined,
			});
		}
	});

	const b5 = await event(beta, "B5", {
		participationLimit: 2,
		registrationOpens: at("2025-03-20T10:00:00Z"),
		eventStart: at("2025-04-08T16:00:00Z"),
	});
	await act(t, b5, u.u2!, "registered", "2025-03-21T10:00:00Z");
	await act(t, b5, u.u4!, "registered", "2025-03-21T11:00:00Z");
	await act(t, b5, u.u9!, "waitlisted", "2025-03-22T11:00:00Z");
	await attend(t, b5, u.u2!, "no_show");
	await attend(t, b5, u.u4!, "confirmed");

	vi.useRealTimers();
	return {
		t,
		alpha,
		beta,
		gamma,
		u,
		events: { a1, a2, a3, a4, a5, b1, b2, b3, b4, b5, c2 },
		intern: asUser(t, intern),
	};
}

export type World = Awaited<ReturnType<typeof buildWorld>>;

export async function insightOutputs(world: World) {
	const { intern, alpha, beta } = world;
	const arg = { now: NOW };
	return {
		semester: await intern.query(api.engagement.queries.semester, arg),
		pastAutumn: await intern.query(api.engagement.queries.past, {
			...arg,
			semester: "høst",
			year: 2026,
		}),
		pastSpring: await intern.query(api.engagement.queries.past, {
			...arg,
			semester: "vår",
			year: 2026,
		}),
		pastOld: await intern.query(api.engagement.queries.past, {
			...arg,
			semester: "vår",
			year: 2025,
		}),
		historyAlpha: await intern.query(api.engagement.companies.history, {
			...arg,
			companyId: alpha,
		}),
		historyBeta: await intern.query(api.engagement.companies.history, { ...arg, companyId: beta }),
		detailAlpha: await intern.query(api.engagement.companies.detail, {
			...arg,
			companyId: alpha,
			semester: "høst",
			year: 2026,
		}),
		detailBeta: await intern.query(api.engagement.companies.detail, {
			...arg,
			companyId: beta,
			semester: "høst",
			year: 2026,
		}),
		list: await intern.query(api.engagement.companies.list, {
			...arg,
			semester: "høst",
			year: 2026,
		}),
		foods: await intern.query(api.engagement.companies.foods, {
			...arg,
			semester: "høst",
			year: 2026,
		}),
	};
}

export function normalised(world: World, value: unknown) {
	const names = new Map<string, string>();
	for (const [name, id] of Object.entries(world.events)) names.set(id, `event:${name}`);
	names.set(world.alpha, "company:alpha");
	names.set(world.beta, "company:beta");
	names.set(world.gamma, "company:gamma");
	return JSON.parse(
		JSON.stringify(value, (_key, item) =>
			typeof item === "string"
				? (names.get(item) ?? item.replace(/^https?:\/\/\S+$/, "url"))
				: item,
		),
	);
}

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
