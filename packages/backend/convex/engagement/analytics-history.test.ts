import { salesTotals } from "@workspace/shared/products";
import { describe, expect, it } from "vitest";
import {
	insertEvent,
	insertRegistration,
	insertStudent,
	insertUser,
	setupAdminAndEditor,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import { audienceOf } from "./audience";

const at = Date.parse;
const product = {
	name: "Product",
	shortDescription: "",
	longDescription: "",
	category: "event" as const,
	unitPriceOre: 3000000,
	vatRate: 25,
	active: true,
	sortOrder: 0,
};

describe("analytics history regressions", () => {
	it("preserves earlier pace points when a seated participant cancels", async () => {
		const { t, admin, companyId } = await setupAdminAndEditor();
		const opens = at("2026-09-01T00:00Z"),
			start = at("2026-09-11T00:00Z"),
			now = at("2026-09-09T00:00Z");
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: opens,
			eventStart: start,
		});
		const user = await insertUser(t, "pace@example.test");
		const registrationId = await insertRegistration(
			t,
			eventId,
			user._id,
			"registered",
			opens + 1000,
		);
		await t.run((ctx) =>
			ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: "registered",
				at: opens + 1000,
			}),
		);
		const before = await admin.query(api.engagement.queries.paceCurve, { eventId, now });
		expect(before?.points.find((p) => p.progress === 0.5)?.actual).toBe(1);
		await t.run(async (ctx) => {
			await ctx.db.delete(registrationId);
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: "unregistered",
				fromStatus: "registered",
				at: now - 1000,
			});
		});
		const after = await admin.query(api.engagement.queries.paceCurve, { eventId, now });
		expect(after?.points.find((p) => p.progress === 0.5)?.actual).toBe(1);
		expect(after?.points.at(-1)?.actual).toBeNull();
		expect(after?.points.find((p) => p.progress === 0.8)?.actual).toBe(0);
	});

	it("preserves the first time to full after a seat replacement", async () => {
		const { t, admin, companyId } = await setupAdminAndEditor();
		const opens = at("2026-09-01T00:00Z");
		const eventId = await insertEvent(t, companyId, {
			registrationOpens: opens,
			eventStart: opens + 86400000,
			participationLimit: 1,
		});
		const user = await insertUser(t, "full@example.test");
		await insertRegistration(t, eventId, user._id, "registered", opens + 36000000);
		await t.run(async (ctx) => {
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: "registered",
				at: opens + 60000,
			});
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: "unregistered",
				fromStatus: "registered",
				at: opens + 7200000,
			});
			await ctx.db.insert("registrationLog", {
				eventId,
				userId: user._id,
				change: "registered",
				at: opens + 36000000,
			});
		});
		const rows = await admin.query(api.engagement.companies.list, {
			semester: "høst",
			year: 2026,
			now: opens + 86400000,
		});
		expect(rows[0]?.hoursToFull).toBeCloseTo(1 / 60);
		const upcoming = await admin.query(api.engagement.queries.upcoming, { now: opens + 36001000 });
		expect(upcoming.events[0]?.status).toEqual({ kind: "full", minutesToFull: 1 });
	});

	it("includes population cohorts with zero participation and their previous reach", async () => {
		const { t } = await setupAdminAndEditor();
		const u1 = await insertUser(t, "bachelor@example.test"),
			u2 = await insertUser(t, "master@example.test");
		const b = await insertStudent(t, u1._id, { degree: "Bachelor", year: 1 });
		const m = await insertStudent(t, u2._id, { degree: "Master", year: 4 });
		const [bs, ms] = await t.run(async (ctx) => [await ctx.db.get(b), await ctx.db.get(m)]);
		if (!bs || !ms) throw new Error("Students not found");
		const data = audienceOf([bs], [bs, ms], [bs, ms]);
		expect(data.cohorts).toHaveLength(2);
		expect(data.cohorts[1]).toMatchObject({
			degree: "Master",
			registrations: 0,
			reach: 0,
			previousReach: 1,
			share: 0,
			populationShare: 0.5,
			change: -0.5,
		});
		const empty = audienceOf([], [bs, ms], [bs, ms]);
		expect(empty.cohorts.every((row) => row.share === 0 && row.reach === 0)).toBe(true);
		expect(data.cohorts[0]?.degree).toBe("Bachelor");
	});

	it("excludes signups after the previous-semester comparison cutoff", async () => {
		const { t, admin, companyId } = await setupAdminAndEditor();
		const now = at("2027-02-01T12:00Z");
		const previous = await insertEvent(t, companyId, {
			registrationOpens: at("2026-08-01T00:00Z"),
			eventStart: at("2026-10-01T00:00Z"),
		});
		const current = await insertEvent(t, companyId, {
			registrationOpens: at("2027-01-01T00:00Z"),
			eventStart: at("2027-02-05T00:00Z"),
		});
		const user = await insertUser(t, "comparison@example.test");
		await insertStudent(t, user._id, { year: 2 });
		await insertRegistration(t, current, user._id, "registered", now - 1000);
		await insertRegistration(t, previous, user._id, "registered", at("2026-09-30T00:00Z"));
		const result = await admin.query(api.engagement.queries.semester, { now });
		expect(result.audience.cohorts[0]?.previousReach).toBe(0);
	});

	it("excludes sponsor listing revenue and retains the original publication semester", async () => {
		const { t, admin, companyId } = await setupAdminAndEditor();
		const productId = await t.run((ctx) =>
			ctx.db.insert("products", {
				...product,
				category: "job_listing",
				volumeTiers: [{ quantity: 1, totalPriceOre: 300000 }],
			}),
		);
		await t.run((ctx) => ctx.db.patch(companyId, { mainSponsor: true }));
		const id = await t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Ad",
				teaser: "Ad",
				description: "Ad",
				applicationUrl: "",
				type: "Fulltid",
				company: companyId,
				published: true,
				publishedAt: at("2026-09-01T00:00Z"),
				deadline: at("2026-11-01T00:00Z"),
				product: { productId, name: "Product" },
			}),
		);
		expect(await admin.query(api.products.stats.sales, {})).toMatchObject([
			{ semester: "høst", year: 2026, revenueOre: 0, excluded: false },
		]);
		await t.run((ctx) => ctx.db.patch(id, { deadline: at("2027-02-01T00:00Z") }));
		expect(await admin.query(api.products.stats.sales, {})).toMatchObject([
			{ semester: "høst", year: 2026, revenueOre: 0 },
		]);
	});

	it("retains event sale provenance when its catalogue category changes", async () => {
		const { t, admin, companyId } = await setupAdminAndEditor();
		const productId = await t.run((ctx) => ctx.db.insert("products", product));
		await insertEvent(t, companyId, {
			product: { productId, name: "Product", unitPriceOre: product.unitPriceOre },
		});
		await insertEvent(t, companyId, {
			externalEvent: true,
			product: { productId, name: "Product", unitPriceOre: product.unitPriceOre },
		});
		const initialSales = await admin.query(api.products.stats.sales, {});
		expect(initialSales.map(({ category }) => category).sort()).toEqual([
			"event",
			"external_event",
		]);
		expect(salesTotals(initialSales)).toMatchObject({
			eventsSold: 2,
			jobListings: 0,
		});
		await admin.mutation(api.products.mutations.update, {
			id: productId,
			name: "Product",
			shortDescription: "",
			longDescription: "",
			category: "job_listing",
			vatRate: 25,
			volumeTiers: [{ quantity: 1, totalPriceOre: 300000 }],
		});
		const changedSales = await admin.query(api.products.stats.sales, {});
		expect(changedSales.map(({ category }) => category).sort()).toEqual([
			"event",
			"external_event",
		]);
		expect(salesTotals(changedSales)).toMatchObject({
			eventsSold: 2,
			jobListings: 0,
		});
	});
});
