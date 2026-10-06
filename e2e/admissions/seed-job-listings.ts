import { api } from "@workspace/backend/convex/api";
import { localIdentity } from "@workspace/shared/local";
import { ConvexHttpClient } from "convex/browser";
import { LocalDatabase } from "./seed-database";

const DAY = 24 * 60 * 60 * 1000;
const seedOrgNumberBase = 990000000;
const pixel = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	),
	(char) => char.charCodeAt(0),
);

export type JobListingSeedScenario = "empty" | "listings" | "orders" | "full";

async function localAdmin(db: LocalDatabase) {
	const existing = await db.find("users", "externalId", localIdentity.subject);
	const userId =
		existing?._id ??
		(await db.insert("users", {
			externalId: localIdentity.subject,
			firstName: localIdentity.givenName,
			lastName: localIdentity.familyName,
			email: localIdentity.email,
			image: localIdentity.profileUrl,
			locked: false,
		}));
	const rights = await db.find("accessRights", "userId", userId);
	if (!rights) await db.insert("accessRights", { userId, role: "super-admin" });
	return userId;
}

async function logo(url: string, db: LocalDatabase, name: string) {
	const client = new ConvexHttpClient(url);
	const uploadUrl = await client.mutation(api.companies.mutations.generateUploadUrl, {});
	const response = await fetch(uploadUrl, {
		method: "POST",
		headers: { "Content-Type": "image/png" },
		body: pixel,
	});
	const { storageId } = (await response.json()) as { storageId: string };
	return db.insert("companyLogos", { name, image: storageId as never });
}

const seedProductName = "Stillingsannonse";

async function clearJobListings(db: LocalDatabase) {
	for (const table of [
		"jobListingOrderItems",
		"jobListingOrders",
		"jobListingContacts",
		"jobListings",
	] as const)
		await db.clear(table);
	for (const product of await db.all("products"))
		if (product.name === seedProductName) await db.delete("products", product._id);
	for (const company of await db.all("companies"))
		if (company.orgNumber >= seedOrgNumberBase && company.orgNumber < seedOrgNumberBase + 100)
			await db.delete("companies", company._id);
}

export async function seedJobListings(url: string, scenario: JobListingSeedScenario) {
	const db = new LocalDatabase(url);
	await clearJobListings(db);
	await localAdmin(db);
	if (scenario === "empty") return;
	const now = Date.now();
	const logoId = await logo(url, db, "Seed");
	const companies = await Promise.all(
		["Nordlys Teknologi", "Fjord Data", "Polar Systemer"].map((name, index) =>
			db.insert("companies", {
				orgNumber: seedOrgNumberBase + index,
				name,
				description: `${name} bygger programvare.`,
				mainSponsor: false,
				logo: logoId,
			}),
		),
	);
	const listing = (
		index: number,
		title: string,
		type: string,
		deadlineDays: number,
		published: boolean,
	) =>
		db.insert("jobListings", {
			title,
			type,
			teaser: `${title} hos ${index}.`,
			description: "<p>Spennende oppgaver for deg som studerer informatikk.</p>",
			applicationUrl: "https://example.com/apply",
			published,
			company: companies[index % companies.length] ?? companies[0],
			deadline: now + deadlineDays * DAY,
			publishedAt: published ? now - DAY : undefined,
		});
	if (scenario === "listings" || scenario === "full") {
		await listing(0, "Systemutvikler", "Fulltid", 20, true);
		await listing(1, "Sommerjobb i dataanalyse", "Sommerjobb", 40, true);
		await listing(2, "Utkast: Backendutvikler", "Deltid", 30, false);
		await listing(0, "Internship i sikkerhet", "Internship", -30, true);
		await listing(1, "Trainee 2025", "Utviklingsprogram", -90, true);
	}
	if (scenario === "orders" || scenario === "full") {
		const productId = await db.insert("products", {
			name: seedProductName,
			shortDescription: "En annonse på nettsiden.",
			longDescription: "En annonse på nettsiden.",
			category: "job_listing",
			unitPriceOre: 500000,
			vatRate: 25,
			sortOrder: 0,
			active: true,
		});
		const orderId = await db.insert("jobListingOrders", {
			reference: "SEED-2026-001",
			submissionId: "seed-submission-1",
			status: "confirmed",
			companyId: companies[0],
			productId,
			productName: "Stillingsannonse",
			startup: false,
			quantity: 1,
			priceOre: 500000,
			vatRate: 25,
			contact: { name: "Kari Nordmann", email: "kari@example.com" },
			confirmedAt: now - DAY,
		});
		await db.insert("jobListingOrderItems", {
			orderId,
			position: 0,
			title: "Frontendutvikler",
			teaser: "Bygg grensesnitt for tusenvis av brukere.",
			description: "<p>Du jobber med React og TypeScript.</p>",
			applicationUrl: "https://example.com/apply",
			deadline: new Date(now + 30 * DAY).toISOString().slice(0, 16),
			type: "Fulltid",
		});
	}
}
