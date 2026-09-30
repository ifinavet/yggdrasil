import { internalMutation } from "../_generated/server";
import { requireLocal } from "../products/localSeed";
import { snapshotOf } from "../products/sales";
import { SEED_PRODUCT_NAMES } from "../products/seed";
import { sourceKeyOf } from "./schedule";
import type { InvoiceDetails, InvoiceSource, InvoiceStatus } from "./schema";

const DAY = 86_400_000;
const STATUSES: InvoiceStatus[] = [
	"sent",
	"sent",
	"pending",
	"pending",
	"pending",
	"pending",
	"pending",
	"cancelled",
];

/** Adds illustrative invoices only to an isolated local Convex deployment. */
export const seedLocalInvoices = internalMutation({
	args: {},
	handler: async (ctx) => {
		requireLocal();
		const existing = await ctx.db.query("invoices").first();
		if (existing) return { inserted: 0 };

		const companies = await ctx.db.query("companies").take(20);
		const products = await ctx.db.query("products").take(20);
		const listingProduct = products.find(
			(product) => product.name === SEED_PRODUCT_NAMES.jobListing,
		);
		const eventProduct = products.find(
			(product) => product.name === SEED_PRODUCT_NAMES.regularEvent,
		);
		if (companies.length < 12 || !listingProduct || !eventProduct) {
			throw new Error("Run products/localSeed:seedLocalSales before seeding invoices.");
		}

		const now = Date.now();
		const semesterId = await ctx.db.insert("semesters", {
			year: new Date(now).getUTCFullYear(),
			term: "autumn",
			status: "closed",
		});
		for (let index = 0; index < 20; index++) {
			const company = companies[index % companies.length];
			if (!company) throw new Error("No company available for the invoice preview.");
			const isEvent = index % 3 === 1;
			const serviceAt = now + (index - 12) * 7 * DAY;
			const status =
				serviceAt <= now ? (STATUSES[index % STATUSES.length] ?? "pending") : "pending";
			const amount = isEvent
				? (eventProduct.unitPriceOre ?? 3_000_000)
				: ([300_000, 550_000, 750_000][index % 3] ?? 300_000);
			const plan: InvoiceDetails = {
				customer: {
					name: company.registryName ?? company.name,
					organizationNumber: String(company.orgNumber),
					email: `faktura@${company.name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
					billingDetails: "Demoveien 1, 0001 Oslo",
				},
				invoiceText: isEvent
					? `Bedriftspresentasjon med ${company.name}`
					: `Stillingsannonser, bestilling DEMO-${index + 1}`,
				line: {
					description: isEvent
						? eventProduct.name
						: `${listingProduct.name} (${(index % 3) + 1} stk.)`,
					unitPrice: amount,
					vatRate: 25,
				},
			};

			let source: InvoiceSource;
			if (isEvent) {
				const eventId = await ctx.db.insert("events", {
					title: `Bedriftspresentasjon med ${company.name}`,
					teaser: `Møt ${company.name}.`,
					description: "Illustrative lokale testdata.",
					eventStart: serviceAt,
					registrationOpens: serviceAt - 14 * DAY,
					participationLimit: 40,
					location: "IFI",
					food: "Pizza",
					language: "Norsk",
					ageRestriction: "Ingen",
					externalEvent: false,
					hostingCompany: company._id,
					published: true,
					product: snapshotOf(eventProduct),
				});
				const applicationId = await ctx.db.insert("companyApplications", {
					semesterId,
					formVersion: 1,
					orgNumber: String(company.orgNumber),
					registry: {
						name: company.registryName ?? company.name,
						organizationForm: { code: "AS", description: "Aksjeselskap" },
						fetchedAt: now,
					},
					contact: { name: "Demo Kontakt", email: "kontakt@example.com", phone: "00000000" },
					eventType: "standard_presentation",
					minStudents: 20,
					maxStudents: 40,
					description: "Illustrative lokale testdata.",
					availableDates: [],
					venue: "campus",
					wantsToUseEscape: "no",
					foodAndDrinks: true,
					foodPurchasedBy: "navet",
					billing: { email: plan.customer.email },
					targetDegrees: [],
					targetStudyPrograms: [],
					consent: { version: "demo", consentedAt: now },
					status: "confirmed",
					eventId,
				});
				source = { kind: "companyApplication" as const, applicationId };
			} else {
				const orderId = await ctx.db.insert("jobListingOrders", {
					reference: `DEMO-${index + 1}`,
					submissionId: `invoice-preview-${index}`,
					status: "published",
					companyId: company._id,
					productId: listingProduct._id,
					productName: listingProduct.name,
					startup: false,
					quantity: (index % 3) + 1,
					priceOre: amount,
					contact: { name: "Demo Kontakt", email: "kontakt@example.com" },
					billing: {
						address: "Demoveien 1",
						email: plan.customer.email ?? "faktura@example.com",
						reference: "",
					},
				});
				source = { kind: "jobListingOrder" as const, orderId };
			}

			await ctx.db.insert("invoices", {
				source,
				sourceKey: sourceKeyOf(source),
				serviceAt,
				status,
				...(status === "sent" && {
					sentAt: serviceAt + DAY,
					sentDetails: plan,
				}),
			});
		}
		return { inserted: 20 };
	},
});

/** Clears only the illustrative invoice records before changing the preview schema. */
export const clearLocalInvoices = internalMutation({
	args: {},
	handler: async (ctx) => {
		requireLocal();
		const invoices = await ctx.db.query("invoices").collect();
		for (const invoice of invoices) await ctx.db.delete(invoice._id);
		return invoices.length;
	},
});
