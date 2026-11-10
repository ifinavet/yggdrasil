import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applicationById,
	insertApplication,
	insertEvent,
	insertEventProduct,
	insertSemester,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { BACKFILL } from "./references";

const TABLES = [
	"companyApplications",
	"pendingCompanyApplications",
	"companyApplicationOffers",
	"eventPlanning",
	"eventPlanningSubmissions",
] as const;

async function tableReport(t: TestBackend, table: (typeof TABLES)[number]) {
	const result = { rows: 0, missing: [] as { id: string; reason: string }[] };
	let cursor: string | null = null;
	for (;;) {
		const page: {
			rows: number;
			missing: { id: string; reason: string }[];
			isDone: boolean;
			continueCursor: string;
		} = await t.query(internal.products.references.report, { table, cursor, numItems: 2 });
		result.rows += page.rows;
		result.missing.push(...page.missing);
		if (page.isDone) return result;
		cursor = page.continueCursor;
	}
}

async function report(t: TestBackend) {
	const tables = await Promise.all(TABLES.map((table) => tableReport(t, table)));
	return {
		typesWithoutOneActiveProduct: await t.query(
			internal.products.references.typesWithoutOneActiveProduct,
			{},
		),
		tables: Object.fromEntries(TABLES.map((table, index) => [table, tables[index]])) as Record<
			(typeof TABLES)[number],
			Awaited<ReturnType<typeof tableReport>>
		>,
	};
}

const ANSWERS: Doc<"eventPlanning">["answers"] = {
	title: "Bli kjent med oss",
	teaser: "",
	description: "",
	location: "",
	food: "",
	notes: "",
	standDetails: "",
	capacity: 40,
	startTime: "16:15",
	venue: "campus",
	foodAndDrinks: "unsure",
	foodPurchasedBy: "undecided",
	alcohol: "unsure",
	ageRestriction: "unsure",
	stand: "unsure",
	language: "Norsk",
};

const FORM = {
	orgNumber: "924773189",
	contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+4741234567" },
	eventType: "large_presentation" as const,
	minStudents: 25,
	maxStudents: 80,
	description: "Presentasjon og kodeoppgave.",
	availableDates: ["2027-02-09"],
	venue: "campus" as const,
	wantsToUseEscape: "unsure" as const,
	foodAndDrinks: true,
	foodPurchasedBy: "company" as const,
	billing: { email: "faktura@fjordkode.no" },
	targetDegrees: [],
	targetStudyPrograms: [],
	consent: true,
};

async function archived(t: TestBackend, eventType: "standard_presentation", name: string) {
	const productId = await insertEventProduct(t, eventType, name);
	await t.run((ctx) => ctx.db.patch(productId, { active: false }));
	return productId;
}

function tagged(productId: Id<"products">) {
	return { product: { productId, name: "Kopi", unitPriceOre: 1, vatRate: 25 } };
}

async function backfill(t: TestBackend) {
	await t.mutation(internal.migrations.run, BACKFILL);
	await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function fixture() {
	const { t, companyId } = await setup();
	const semesterId = await insertSemester(t);
	const user = await insertUser(t, "kari@ifinavet.no");
	const insertOffer = (
		applicationId: Id<"companyApplications">,
		eventType: Doc<"companyApplicationOffers">["eventType"],
		productId?: Id<"products">,
	) =>
		t.run((ctx) =>
			ctx.db.insert("companyApplicationOffers", {
				applicationId,
				date: "2027-02-09",
				eventType,
				productId,
				maxStudents: 40,
				linkToken: crypto.randomUUID(),
				sentAt: Date.now(),
				sentBy: user._id,
				status: "pending",
			}),
		);
	const insertPlanning = (eventId: Id<"events">, fields: Partial<Doc<"eventPlanning">> = {}) =>
		t.run((ctx) =>
			ctx.db.insert("eventPlanning", {
				eventId,
				companyId,
				contactName: "Bedrift",
				contactEmail: "contact@example.com",
				signature: "",
				answers: ANSWERS,
				revision: 0,
				generation: 0,
				status: "preparing",
				...fields,
			}),
		);
	const insertPending = (form: Doc<"pendingCompanyApplications">["form"]) =>
		t.run((ctx) =>
			ctx.db.insert("pendingCompanyApplications", {
				semesterId,
				submissionId: crypto.randomUUID(),
				form,
				registry: {
					name: "FJORDKODE AS",
					organizationForm: { code: "AS", description: "Aksjeselskap" },
					fetchedAt: Date.now(),
				},
				submittedAt: Date.now(),
			}),
		);
	const insertSubmission = async (
		answers: Doc<"eventPlanning">["answers"],
		draft: Doc<"eventPlanning">["answers"],
	) => {
		const planningId = await insertPlanning(await insertEvent(t, companyId));
		return t.run((ctx) =>
			ctx.db.insert("eventPlanningSubmissions", {
				planningId,
				submissionId: crypto.randomUUID(),
				generation: 0,
				answers,
				draft,
				baseEvent: "",
				eventDate: "2027-02-09",
				revision: 0,
				status: "ready",
			}),
		);
	};
	const get = <
		T extends
			| "companyApplicationOffers"
			| "eventPlanning"
			| "pendingCompanyApplications"
			| "eventPlanningSubmissions",
	>(
		id: Id<T>,
	) => t.run((ctx) => ctx.db.get(id));
	return {
		t,
		companyId,
		semesterId,
		insertOffer,
		insertPlanning,
		insertPending,
		insertSubmission,
		get,
	};
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("backfill of product references", () => {
	it("gives an application the product its event was tagged with, else the product of its type", async () => {
		const { t, companyId, semesterId } = await fixture();
		const taggedId = await archived(t, "standard_presentation", "Avtalt ordinær");
		const standardId = await insertEventProduct(t, "standard_presentation");
		const handTagged = await insertApplication(t, semesterId, {
			eventId: await insertEvent(t, companyId, tagged(taggedId)),
		});
		const guessed = await insertApplication(t, semesterId, {
			eventId: await insertEvent(t, companyId, { ...tagged(taggedId), productGuessed: true }),
		});
		const eventless = await insertApplication(t, semesterId);
		const kept = await insertApplication(t, semesterId, { productId: taggedId });

		await backfill(t);

		expect((await applicationById(t, handTagged)).productId).toBe(taggedId);
		expect((await applicationById(t, guessed)).productId).toBe(standardId);
		expect((await applicationById(t, eventless)).productId).toBe(standardId);
		expect((await applicationById(t, kept)).productId).toBe(taggedId);
	});

	it("leaves a row alone and reports why when the product cannot be told", async () => {
		const { t, companyId, semesterId } = await fixture();
		await archived(t, "standard_presentation", "Bare arkivert");
		const workshopId = await insertEventProduct(t, "workshop");
		await insertEventProduct(t, "large_presentation");
		await insertEventProduct(t, "large_presentation", "Stor nummer to");
		const conflicting = await insertApplication(t, semesterId, {
			eventId: await insertEvent(t, companyId, tagged(workshopId)),
		});
		const twoProducts = await insertApplication(t, semesterId, {
			eventType: "large_presentation",
		});
		const archivedOnly = await insertApplication(t, semesterId);
		const fine = await insertApplication(t, semesterId, { eventType: "workshop" });

		await backfill(t);

		for (const id of [conflicting, twoProducts, archivedOnly])
			expect((await applicationById(t, id)).productId).toBeUndefined();
		expect((await applicationById(t, fine)).productId).toBe(workshopId);

		const result = await report(t);
		expect(result.typesWithoutOneActiveProduct).toEqual([
			{ eventType: "standard_presentation", activeProducts: 0 },
			{ eventType: "large_presentation", activeProducts: 2 },
			{ eventType: "social", activeProducts: 0 },
		]);
		expect(result.tables.companyApplications).toEqual({
			rows: 4,
			missing: [
				{ id: conflicting, reason: "the event is tagged with a product of another type" },
				{ id: twoProducts, reason: "several active products have this type" },
				{ id: archivedOnly, reason: "no active product has this type" },
			],
		});
	});

	it("gives offers and planning the application's product before the event's and the type's", async () => {
		const { t, companyId, semesterId, insertOffer, insertPlanning, get } = await fixture();
		const orderedId = await archived(t, "standard_presentation", "Bestilt ordinær");
		const taggedId = await archived(t, "standard_presentation", "Merket ordinær");
		const standardId = await insertEventProduct(t, "standard_presentation");
		const largeId = await insertEventProduct(t, "large_presentation");
		const eventId = await insertEvent(t, companyId, tagged(taggedId));
		const applicationId = await insertApplication(t, semesterId, { eventId, productId: orderedId });
		const legacyApplicationId = await insertApplication(t, semesterId, {
			eventId: await insertEvent(t, companyId, tagged(taggedId)),
		});
		const largeOrderEventId = await insertEvent(t, companyId, tagged(taggedId));
		await insertApplication(t, semesterId, {
			eventType: "large_presentation",
			productId: largeId,
			eventId: largeOrderEventId,
		});

		const sameType = await insertOffer(applicationId, "standard_presentation");
		const legacyOffer = await insertOffer(legacyApplicationId, "standard_presentation");
		const otherType = await insertOffer(applicationId, "large_presentation");
		const keptOffer = await insertOffer(applicationId, "standard_presentation", standardId);

		const ordered = await insertPlanning(eventId, { eventType: "standard_presentation" });
		const kept = await insertPlanning(eventId, {
			eventType: "standard_presentation",
			productId: standardId,
		});
		const otherOrderType = await insertPlanning(largeOrderEventId, {
			eventType: "standard_presentation",
		});
		const guessed = await insertPlanning(
			await insertEvent(t, companyId, { ...tagged(taggedId), productGuessed: true }),
			{ eventType: "standard_presentation" },
		);
		const untyped = await insertPlanning(await insertEvent(t, companyId, tagged(taggedId)));

		await backfill(t);

		expect((await get(sameType))?.productId).toBe(orderedId);
		expect((await get(legacyOffer))?.productId).toBe(taggedId);
		expect((await get(otherType))?.productId).toBe(largeId);
		expect((await get(keptOffer))?.productId).toBe(standardId);
		expect((await get(ordered))?.productId).toBe(orderedId);
		expect((await get(kept))?.productId).toBe(standardId);
		expect((await get(otherOrderType))?.productId).toBe(taggedId);
		expect((await get(guessed))?.productId).toBe(standardId);
		expect((await get(untyped))?.productId).toBeUndefined();
		const { tables } = await report(t);
		expect(tables.eventPlanning).toEqual({ rows: 5, missing: [] });
		expect(tables.companyApplicationOffers).toEqual({ rows: 4, missing: [] });
	});

	it("fills the pending form and each copy of a company's planning answers on its own", async () => {
		const { t, companyId, insertPending, insertPlanning, insertSubmission, get } = await fixture();
		const largeId = await insertEventProduct(t, "large_presentation");
		const workshopId = await insertEventProduct(t, "workshop");
		const large = { ...ANSWERS, requestedEventType: "large_presentation" as const };
		const workshop = { ...ANSWERS, title: "Endret", requestedEventType: "workshop" as const };
		const social = { ...ANSWERS, requestedEventType: "social" as const };

		const pending = await insertPending(FORM);
		const keptPending = await insertPending({ ...FORM, productId: workshopId });
		const socialPending = await insertPending({ ...FORM, eventType: "social" });
		const planning = await insertPlanning(await insertEvent(t, companyId), { answers: large });
		const submission = await insertSubmission(large, workshop);
		const keptSubmission = await insertSubmission(
			{ ...large, requestedProductId: workshopId },
			ANSWERS,
		);
		const socialSubmission = await insertSubmission(social, social);

		await backfill(t);

		expect((await get(pending))?.form).toEqual({ ...FORM, productId: largeId });
		expect((await get(keptPending))?.form.productId).toBe(workshopId);
		expect((await get(socialPending))?.form).toEqual({ ...FORM, eventType: "social" });
		expect((await get(planning))?.answers).toEqual({ ...large, requestedProductId: largeId });
		expect(await get(submission)).toMatchObject({
			answers: { ...large, requestedProductId: largeId },
			draft: { ...workshop, requestedProductId: workshopId },
		});
		expect(await get(keptSubmission)).toMatchObject({
			answers: { ...large, requestedProductId: workshopId },
			draft: ANSWERS,
		});

		const { tables } = await report(t);
		expect(tables.pendingCompanyApplications).toEqual({
			rows: 3,
			missing: [{ id: socialPending, reason: "no active product has this type" }],
		});
		expect(tables.eventPlanningSubmissions).toEqual({
			rows: 3,
			missing: [
				{ id: socialSubmission, reason: "requested type: no active product has this type" },
				{
					id: socialSubmission,
					reason: "draft requested type: no active product has this type",
				},
			],
		});
	});

	it("reports exactly the rows the backfill left without a product", async () => {
		const { t, companyId, semesterId, insertOffer, insertPlanning } = await fixture();
		await insertEventProduct(t, "standard_presentation");
		const applicationId = await insertApplication(t, semesterId);
		const social = await insertApplication(t, semesterId, { eventType: "social" });
		await insertOffer(applicationId, "standard_presentation");
		const socialOffer = await insertOffer(social, "social");
		const planningId = await insertPlanning(await insertEvent(t, companyId), {
			eventType: "social",
			answers: { ...ANSWERS, requestedEventType: "workshop" },
		});

		await backfill(t);

		const { tables } = await report(t);
		expect(tables.companyApplications.missing.map((row) => row.id)).toEqual([social]);
		expect(tables.companyApplicationOffers.missing.map((row) => row.id)).toEqual([socialOffer]);
		expect(tables.eventPlanning.missing).toEqual([
			{ id: planningId, reason: "no active product has this type" },
			{ id: planningId, reason: "requested type: no active product has this type" },
		]);
		const stillMissing = await t.run(async (ctx) => [
			...(await ctx.db.query("companyApplications").collect()).filter((row) => !row.productId),
			...(await ctx.db.query("companyApplicationOffers").collect()).filter((row) => !row.productId),
		]);
		expect(stillMissing.map((row) => row._id)).toEqual([social, socialOffer]);
	});

	it("counts rows the backfill has not reached yet", async () => {
		const { t, semesterId } = await fixture();
		await insertEventProduct(t, "standard_presentation");
		const applicationId = await insertApplication(t, semesterId);

		expect((await report(t)).tables.companyApplications.missing).toEqual([
			{ id: applicationId, reason: "not filled in yet" },
		]);
	});
});
