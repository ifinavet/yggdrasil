import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	DAY_IN_MS,
	grantRole,
	insertEvent,
	insertFoodItem,
	insertRegistration,
	insertStudent,
	insertUser,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00Z");

afterEach(() => {
	vi.useRealTimers();
});

async function twoCompanies() {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(at("2026-09-20T00:00:00Z"));
	const { t, companyId } = await setup();
	const intern = await insertUser(t, "intern@example.com");
	await grantRole(t, intern._id, "internal");
	const otherId = await t.run(async (ctx) => {
		const { _id, _creationTime, ...company } = (await ctx.db.get(companyId)) as Doc<"companies">;
		return ctx.db.insert("companies", { ...company, orgNumber: 987654321, name: "Annen bedrift" });
	});
	const held = await insertEvent(t, companyId, {
		title: "Holdt",
		registrationOpens: at("2026-10-01T10:00:00Z"),
		eventStart: at("2026-10-10T16:00:00Z"),
	});
	await insertEvent(t, companyId, {
		registrationOpens: at("2026-10-15T10:00:00Z"),
		eventStart: at("2026-10-25T16:00:00Z"),
	});
	const popular = await insertEvent(t, otherId, {
		participationLimit: 1,
		registrationOpens: at("2026-10-15T10:00:00Z"),
		eventStart: at("2026-10-25T16:00:00Z"),
	});
	const register = async (email: string, eventId: typeof held, year: number, time: number) => {
		const user = await insertUser(t, email);
		await insertStudent(t, user._id, { year });
		await insertRegistration(t, eventId, user._id, "registered", time);
		return user;
	};
	const ada = await register("ada@example.com", held, 2, NOW - 15 * DAY_IN_MS);
	const bo = await register("bo@example.com", held, 2, NOW - 15 * DAY_IN_MS);
	await register("cy@example.com", popular, 3, NOW - DAY_IN_MS);
	const dag = await insertUser(t, "dag@example.com");
	await insertRegistration(t, popular, dag._id, "waitlist", NOW - DAY_IN_MS);
	await t.run(async (ctx) => {
		const registrations = await ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", held))
			.collect();
		for (const registration of registrations) {
			await ctx.db.patch(registration._id, {
				attendanceStatus: registration.userId === ada._id ? "confirmed" : "no_show",
			});
		}
		await ctx.db.insert("registrationLog", {
			eventId: held,
			userId: bo._id,
			change: "unregistered",
			fromStatus: "registered",
			at: at("2026-10-10T10:00:00Z"),
		});
	});
	return { t, companyId, otherId, held, ada, bo, intern: asUser(t, intern) };
}

const semester = { now: NOW, semester: "høst" as const, year: 2026 };

describe("list", () => {
	it("ranks every company by demand with its fill, attendance and late unregistrations", async () => {
		const { intern } = await twoCompanies();

		const companies = await intern.query(api.engagement.companies.list, semester);

		expect(
			companies.map(({ name, events, registered, seats, demand, attendance, latePerEvent }) => ({
				name,
				events,
				registered,
				seats,
				demand,
				attendance,
				latePerEvent,
			})),
		).toEqual([
			{
				name: "Annen bedrift",
				events: 1,
				registered: 1,
				seats: 1,
				demand: 2,
				attendance: null,
				latePerEvent: null,
			},
			{
				name: "Testbedrift",
				events: 2,
				registered: 2,
				seats: 20,
				demand: 0.1,
				attendance: 0.5,
				latePerEvent: 1,
			},
		]);
	});
});

describe("foods", () => {
	it("lists each event's food name, registrations and seats", async () => {
		const { t, held, intern } = await twoCompanies();
		const pizza = await insertFoodItem(t, "pizza");
		const burritos = await insertFoodItem(t, "burritos");
		await t.run(async (ctx) => {
			await ctx.db.patch(held, { foodItem: pizza });
			const popular = await ctx.db
				.query("events")
				.filter((q) => q.eq(q.field("participationLimit"), 1))
				.first();
			await ctx.db.patch((popular as Doc<"events">)._id, { foodItem: burritos });
		});

		const foods = await intern.query(api.engagement.companies.foods, semester);

		expect(
			foods
				.map(({ foodItem, name, registrations, seats }) => ({
					foodItem,
					name,
					registrations,
					seats,
				}))
				.sort((a, b) => b.registrations - a.registrations || a.seats - b.seats),
		).toEqual([
			{ foodItem: burritos, name: "🌯 Burritos", registrations: 2, seats: 1 },
			{ foodItem: pizza, name: "🍕 Pizza", registrations: 2, seats: 10 },
			{ foodItem: null, name: null, registrations: 0, seats: 10 },
		]);
	});
});

describe("detail", () => {
	it("compares the company with the average, describes its audience and lists its held events", async () => {
		const { companyId, held, intern } = await twoCompanies();

		const detail = await intern.query(api.engagement.companies.detail, { companyId, ...semester });

		expect(detail.name).toBe("Testbedrift");
		expect(detail.comparison.find(({ key }) => key === "demand")).toEqual({
			key: "demand",
			value: 0.1,
			average: 1.05,
			rank: 2,
			of: 2,
			standing: "worse",
		});
		expect(detail.audience.total).toBe(2);
		expect(detail.audience.cohorts).toMatchObject([{ label: "Bachelor 2. år", reach: 1 }]);
		expect(detail.events).toMatchObject([
			{ _id: held, title: "Holdt", registered: 2, attended: 1, lateUnregistrations: 1 },
		]);
	});

	it("is empty for a company without events this semester", async () => {
		const { companyId, intern } = await twoCompanies();

		const detail = await intern.query(api.engagement.companies.detail, {
			companyId,
			...semester,
			semester: "vår",
		});

		expect(detail.events).toEqual([]);
		expect(detail.comparison.every(({ value, of }) => value === null && of === 0)).toBe(true);
	});
});

async function insertFeedback(
	t: Awaited<ReturnType<typeof twoCompanies>>["t"],
	eventId: Id<"events">,
	report: { status: Doc<"feedbackReports">["status"]; ratings: [string, number][] } | null,
) {
	await t.run(async (ctx) => {
		const campaignId = await ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "closed",
			opensAt: NOW,
			closesAt: NOW,
			generation: 1,
		});
		if (!report) return;
		await ctx.db.insert("feedbackReports", {
			campaignId,
			eventId,
			eventTitle: "Holdt",
			eventStart: NOW,
			companyName: "Testbedrift",
			recipientEmail: "bedrift@example.com",
			status: report.status,
			questions: [
				{
					key: "satisfaction",
					type: "rating",
					label: "Hvor fornøyd var du?",
					required: true,
					answered: report.ratings.reduce((total, [, count]) => total + count, 0),
					buckets: report.ratings.map(([value, count]) => ({ value, label: value, count })),
				},
			] as Doc<"feedbackReports">["questions"],
			totalResponses: 2,
			buildCursor: null,
			revision: 0,
			retentionAt: NOW,
		});
	});
}

describe("detail feedback and returning students", () => {
	it("scores feedback from finished reports and counts students back from earlier semesters", async () => {
		const { t, companyId, held, ada, bo, intern } = await twoCompanies();
		await insertFeedback(t, held, {
			status: "approved",
			ratings: [
				["5", 1],
				["4", 1],
			],
		});
		await insertFeedback(t, held, { status: "building", ratings: [["1", 5]] });
		await insertFeedback(t, held, null);
		const earlier = await insertEvent(t, companyId, {
			registrationOpens: at("2026-03-01T10:00:00Z"),
			eventStart: at("2026-03-10T16:00:00Z"),
		});
		const hidden = await insertEvent(t, companyId, {
			published: false,
			registrationOpens: at("2026-03-01T10:00:00Z"),
			eventStart: at("2026-03-12T16:00:00Z"),
		});
		await insertRegistration(t, earlier, ada._id, "registered", NOW);
		await insertRegistration(t, earlier, bo._id, "waitlist", NOW);
		await insertRegistration(t, hidden, bo._id, "registered", NOW);

		const detail = await intern.query(api.engagement.companies.detail, { companyId, ...semester });
		const measured = (key: string) => detail.comparison.find((row) => row.key === key)?.value;

		expect(measured("satisfaction")).toBe(4.5);
		expect(measured("wantToWork")).toBeNull();
		expect(measured("returning")).toBe(1 / 2);
	});
});

describe("history", () => {
	it("follows the company and the average back four semesters", async () => {
		const { t, otherId, intern } = await twoCompanies();
		await insertEvent(t, otherId, {
			registrationOpens: at("2026-03-01T10:00:00Z"),
			eventStart: at("2026-03-10T16:00:00Z"),
		});

		const history = await intern.query(api.engagement.companies.history, {
			companyId: otherId,
			now: NOW,
		});

		expect(history.map(({ semester, year }) => `${semester} ${year}`)).toEqual([
			"vår 2025",
			"høst 2025",
			"vår 2026",
			"høst 2026",
		]);
		expect(history[0]).toEqual({
			semester: "vår",
			year: 2025,
			company: null,
			average: { demand: null, fill: null, attendance: null },
		});
		expect(history[2]).toMatchObject({ company: { demand: 0 }, average: { demand: 0 } });
		expect(history[3]).toMatchObject({ company: { demand: 2 }, average: { demand: 1.05 } });
	});
});
