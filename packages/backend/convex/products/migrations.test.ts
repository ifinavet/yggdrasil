import { describe, expect, it, vi } from "vitest";
import {
	applicationById,
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertEventProduct,
	insertSemester,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { guessEventProductName, seedAndBackfillProducts } from "./migrations";
import { SEED_PRODUCTS } from "./seed";

type Backfill =
	| typeof internal.products.migrations.backfillEventProducts
	| typeof internal.products.migrations.backfillJobListingProducts;

function seedProducts(t: TestBackend) {
	return t.run(async (ctx) => {
		for (const [sortOrder, seed] of SEED_PRODUCTS.entries()) {
			await ctx.db.insert("products", { ...seed, vatRate: 25, sortOrder, active: true });
		}
	});
}

function runOneBatch(t: TestBackend, backfill: Backfill) {
	return t.mutation(backfill, { oneBatchOnly: true, cursor: null, dryRun: false });
}

async function manualSnapshot(t: TestBackend, category: Doc<"products">["category"]) {
	const productId = await t.run((ctx) =>
		ctx.db.insert("products", {
			name: "Manuelt satt",
			shortDescription: "",
			longDescription: "",
			category,
			vatRate: 25,
			sortOrder: 99,
			active: true,
		}),
	);
	return { productId, name: "Manuelt satt", unitPriceOre: 1 };
}

describe("guessEventProductName", () => {
	it("guesses external events", () => {
		expect(guessEventProductName({ externalEvent: true, participationLimit: 10 })).toBe(
			"Eksterne arrangementer",
		);
	});

	it("guesses large events above the standard cap", () => {
		expect(guessEventProductName({ externalEvent: false, participationLimit: 41 })).toBe(
			"Stor bedriftspresentasjon",
		);
	});

	it("guesses regular events at or below the standard cap", () => {
		expect(guessEventProductName({ externalEvent: false, participationLimit: 40 })).toBe(
			"Ordinær bedriftspresentasjon",
		);
	});
});

describe("backfillEventProducts", () => {
	const migrate = (t: TestBackend) =>
		runOneBatch(t, internal.products.migrations.backfillEventProducts);

	it("guesses a product and marks it as guessed for events missing one", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });

		await migrate(t);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event).toMatchObject({
			product: { name: "Ordinær bedriftspresentasjon" },
			productGuessed: true,
		});
	});

	it("skips events that already have a product", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const existing = await manualSnapshot(t, "event");
		const eventId = await insertEvent(t, companyId, {
			participationLimit: 10,
			product: existing,
			productGuessed: false,
		});

		await migrate(t);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toEqual(existing);
		expect(event?.productGuessed).toBe(false);
	});

	it("leaves the event untouched when the guessed product name has no match", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });

		await migrate(t);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event?.product).toBeUndefined();
		expect(event?.productGuessed).toBeUndefined();
	});
});

describe("backfillJobListingProducts", () => {
	const migrate = (t: TestBackend) =>
		runOneBatch(t, internal.products.migrations.backfillJobListingProducts);

	async function insertListing(
		t: TestBackend,
		companyId: Id<"companies">,
		overrides: Record<string, unknown> = {},
	) {
		return t.run((ctx) =>
			ctx.db.insert("jobListings", {
				title: "Sommerjobb",
				type: "internship",
				teaser: "",
				description: "",
				applicationUrl: "",
				published: true,
				company: companyId,
				deadline: Date.now(),
				...overrides,
			}),
		);
	}

	it("guesses the job listing product for listings missing one", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const listingId = await insertListing(t, companyId);

		await migrate(t);

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing).toMatchObject({ product: { name: "Stillingsannonse" }, productGuessed: true });
	});

	it("skips listings that already have a product", async () => {
		const { t, companyId } = await setup();
		await seedProducts(t);
		const existing = await manualSnapshot(t, "job_listing");
		const listingId = await insertListing(t, companyId, {
			product: existing,
			productGuessed: false,
		});

		await migrate(t);

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.product).toEqual(existing);
		expect(listing?.productGuessed).toBe(false);
	});

	it("leaves the listing untouched when no job listing product exists", async () => {
		const { t, companyId } = await setup();
		const listingId = await insertListing(t, companyId);

		await migrate(t);

		const listing = await t.run((ctx) => ctx.db.get(listingId));
		expect(listing?.product).toBeUndefined();
	});
});

describe("seedAndBackfillProducts", () => {
	it("seeds an empty table once and backfills events", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 10 });

		expect(await t.run((ctx) => seedAndBackfillProducts(ctx))).toEqual(
			SEED_PRODUCTS.map((product) => product.name),
		);
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const event = await t.run((ctx) => ctx.db.get(eventId));
		expect(event).toMatchObject({
			product: { name: "Ordinær bedriftspresentasjon" },
			productGuessed: true,
		});
		vi.useRealTimers();
	});

	it("does not seed again after products were renamed or archived", async () => {
		const { t } = await setup();
		await t.run((ctx) => seedAndBackfillProducts(ctx));
		await t.run(async (ctx) => {
			for (const product of await ctx.db.query("products").collect()) {
				await ctx.db.patch(product._id, { name: `${product.name} (gammel)`, active: false });
			}
		});

		expect(await t.run((ctx) => seedAndBackfillProducts(ctx))).toEqual([]);
		const products = await t.run((ctx) => ctx.db.query("products").collect());
		expect(products).toHaveLength(SEED_PRODUCTS.length);
	});
});

describe("backfillProductIds", () => {
	it("gives rows the product of their type and keeps a product they already have", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@ifinavet.no");
		await grantRole(t, admin._id, "admin");
		const semesterId = await insertSemester(t);
		const standardId = await insertEventProduct(t, "standard_presentation");
		const largeId = await insertEventProduct(t, "large_presentation");
		const untouched = await insertApplication(t, semesterId);
		const kept = await insertApplication(t, semesterId, { productId: largeId });
		const social = await insertApplication(t, semesterId, { eventType: "social" });
		const answers = {
			title: "",
			teaser: "",
			description: "",
			location: "",
			food: "",
			notes: "",
			standDetails: "",
			capacity: 40,
			startTime: "16:15",
			venue: "campus" as const,
			foodAndDrinks: "unsure" as const,
			foodPurchasedBy: "undecided" as const,
			alcohol: "unsure" as const,
			ageRestriction: "unsure" as const,
			stand: "unsure" as const,
			language: "Norsk",
		};
		const requested = { ...answers, requestedEventType: "large_presentation" as const };
		const {
			_id,
			_creationTime,
			status,
			formVersion,
			registry,
			consent,
			semesterId: _semesterId,
			...form
		} = await applicationById(t, untouched);
		const ids = await t.run(async (ctx) => {
			const planning = {
				eventId: await ctx.db.insert("events", {
					title: "",
					teaser: "",
					description: "",
					eventStart: 0,
					registrationOpens: 0,
					participationLimit: 40,
					location: "",
					language: "",
					ageRestriction: "",
					externalEvent: false,
					externalUrl: "",
					hostingCompany: companyId,
					published: false,
				}),
				companyId,
				contactName: "",
				contactEmail: "",
				signature: "",
				revision: 0,
				generation: 0,
				status: "preparing" as const,
			};
			const planningId = await ctx.db.insert("eventPlanning", {
				...planning,
				eventType: "standard_presentation",
				answers: requested,
			});
			return {
				pending: await ctx.db.insert("pendingCompanyApplications", {
					semesterId,
					submissionId: "pending-abcdef",
					form: { ...form, consent: true },
					registry,
					submittedAt: 0,
				}),
				offer: await ctx.db.insert("companyApplicationOffers", {
					applicationId: untouched,
					date: "2027-02-09",
					eventType: "standard_presentation",
					maxStudents: 40,
					linkToken: "token",
					sentAt: 0,
					sentBy: admin._id,
					status: "pending",
				}),
				planning: planningId,
				untyped: await ctx.db.insert("eventPlanning", { ...planning, answers }),
				submission: await ctx.db.insert("eventPlanningSubmissions", {
					planningId,
					submissionId: "submission-abcdef",
					generation: 0,
					answers: { ...requested, requestedProductId: standardId },
					draft: requested,
					baseEvent: "",
					eventDate: "2027-02-09",
					revision: 0,
					status: "ready",
				}),
			};
		});

		await asUser(t, admin).mutation(api.products.mutations.backfillProductIds, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect((await applicationById(t, untouched)).productId).toBe(standardId);
		expect((await applicationById(t, kept)).productId).toBe(largeId);
		expect((await applicationById(t, social)).productId).toBeUndefined();
		const rows = await t.run(async (ctx) => ({
			pending: await ctx.db.get(ids.pending),
			offer: await ctx.db.get(ids.offer),
			planning: await ctx.db.get(ids.planning),
			untyped: await ctx.db.get(ids.untyped),
			submission: await ctx.db.get(ids.submission),
		}));
		expect(rows.pending?.form.productId).toBe(standardId);
		expect(rows.offer?.productId).toBe(standardId);
		expect(rows.planning).toMatchObject({
			productId: standardId,
			answers: { ...requested, requestedProductId: largeId },
		});
		expect(rows.untyped?.productId).toBeUndefined();
		expect(rows.untyped?.answers).toEqual(answers);
		expect(rows.submission).toMatchObject({
			answers: { ...requested, requestedProductId: standardId },
			draft: { ...requested, requestedProductId: largeId },
		});
		vi.useRealTimers();
	});
});
