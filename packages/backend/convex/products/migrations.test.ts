import { describe, expect, it, vi } from "vitest";
import {
	insertApplication,
	insertEvent,
	insertSemester,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { internal } from "../_generated/api";
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

	it("moves rows from an event type to its product, and leaves a type without a product", async () => {
		vi.useFakeTimers();
		const { t, companyId } = await setup();
		await seedProducts(t);
		const semesterId = await insertSemester(t);
		const answers = {
			requestedEventType: "large_presentation" as const,
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
			foodAndDrinks: "yes" as const,
			foodPurchasedBy: "company" as const,
			alcohol: "no" as const,
			ageRestriction: "none" as const,
			stand: "no" as const,
			language: "Norsk",
		};
		const applicationId = await insertApplication(t, semesterId, { eventType: "workshop" });
		const socialId = await insertApplication(t, semesterId, { eventType: "social" });
		const eventId = await insertEvent(t, companyId);
		const sentBy = (await insertUser(t, "kari@ifinavet.no"))._id;
		const ids = await t.run(async (ctx) => {
			for (const product of await ctx.db.query("products").collect()) {
				if (product.eventType === "social") await ctx.db.delete(product._id);
			}
			const pendingId = await ctx.db.insert("pendingCompanyApplications", {
				semesterId,
				submissionId: "pending-1",
				form: {
					orgNumber: "924773189",
					contact: { name: "Ingrid", email: "ingrid@fjordkode.no", phone: "+4741234567" },
					eventType: "standard_presentation",
					minStudents: 25,
					maxStudents: 40,
					description: "",
					availableDates: [],
					venue: "campus",
					wantsToUseEscape: "unsure",
					foodAndDrinks: true,
					foodPurchasedBy: "company",
					billing: {},
					targetDegrees: [],
					targetStudyPrograms: [],
					consent: true,
				},
				registry: {
					name: "FJORDKODE AS",
					organizationForm: { code: "AS", description: "Aksjeselskap" },
					fetchedAt: 0,
				},
				submittedAt: 0,
			});
			const pending = await ctx.db.get(pendingId);
			if (!pending) throw new Error("Expected the pending application.");
			const { _id, _creationTime, ...copy } = pending;
			const socialPendingId = await ctx.db.insert("pendingCompanyApplications", {
				...copy,
				submissionId: "pending-2",
				form: { ...copy.form, eventType: "social" },
			});
			const offerId = await ctx.db.insert("companyApplicationOffers", {
				applicationId,
				date: "2027-02-09",
				eventType: "workshop",
				maxStudents: 40,
				linkToken: "token",
				sentAt: 0,
				sentBy,
				status: "pending",
			});
			const planningId = await ctx.db.insert("eventPlanning", {
				eventId,
				companyId,
				eventType: "standard_presentation",
				answers,
				contactName: "",
				contactEmail: "",
				signature: "",
				revision: 0,
				generation: 0,
				status: "preparing",
			});
			const submissionId = await ctx.db.insert("eventPlanningSubmissions", {
				planningId,
				submissionId: "s",
				generation: 0,
				answers,
				draft: { ...answers, requestedEventType: undefined },
				baseEvent: "",
				eventDate: "2027-02-09",
				revision: 0,
				status: "ready",
			});
			return {
				applicationId,
				socialId,
				pendingId,
				socialPendingId,
				offerId,
				planningId,
				submissionId,
			};
		});

		await t.run((ctx) => seedAndBackfillProducts(ctx));
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		await t.run((ctx) => seedAndBackfillProducts(ctx));
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const rows = await t.run(async (ctx) => ({
			products: await ctx.db.query("products").collect(),
			application: await ctx.db.get(ids.applicationId),
			social: await ctx.db.get(ids.socialId),
			pending: await ctx.db.get(ids.pendingId),
			socialPending: await ctx.db.get(ids.socialPendingId),
			offer: await ctx.db.get(ids.offerId),
			planning: await ctx.db.get(ids.planningId),
			submission: await ctx.db.get(ids.submissionId),
		}));
		const idOf = (eventType: string) =>
			rows.products.find((product) => product.eventType === eventType)?._id;
		expect(rows.application).toMatchObject({ productId: idOf("workshop") });
		expect(rows.application).not.toHaveProperty("eventType");
		expect(rows.social).toMatchObject({ eventType: "social" });
		expect(rows.social).not.toHaveProperty("productId");
		expect(rows.pending?.form).toMatchObject({ productId: idOf("standard_presentation") });
		expect(rows.pending?.form).not.toHaveProperty("eventType");
		expect(rows.socialPending?.form).toMatchObject({ eventType: "social" });
		expect(rows.offer).toMatchObject({ productId: idOf("workshop") });
		expect(rows.offer).not.toHaveProperty("eventType");
		expect(rows.planning).toMatchObject({
			productId: idOf("standard_presentation"),
			answers: { requestedProductId: idOf("large_presentation") },
		});
		expect(rows.planning).not.toHaveProperty("eventType");
		expect(rows.planning?.answers).not.toHaveProperty("requestedEventType");
		expect(rows.submission?.answers).toMatchObject({
			requestedProductId: idOf("large_presentation"),
		});
		expect(rows.submission?.draft).not.toHaveProperty("requestedProductId");
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
