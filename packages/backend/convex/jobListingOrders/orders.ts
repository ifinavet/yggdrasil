import {
	type JobListingOrderForm,
	jobListingOrderSchema,
	LOGO_CONTENT_TYPES,
	LOGO_MAX_BYTES,
	orderPriceOre,
} from "@workspace/shared/job-listing-orders";
import { DAY_MS, osloToday } from "@workspace/shared/time";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
} from "../_generated/server";
import { companyBilling } from "../companies/schema";
import { hashLinkToken } from "../lib/tokens";
import { orderRateLimiter } from "./rateLimits";
import { sanitizeRichText } from "./sanitize";
import { type CompanyChangesDoc, orderContact, orderItemFields } from "./schema";
import { loadOrderSettings } from "./settings";

export const CONFIRMATION_TTL_MS = DAY_MS;
export const FEEDBACK_MAX_LENGTH = 1000;

export const orderFormArgs = v.object({
	company: v.union(
		v.object({ kind: v.literal("existing"), companyId: v.string() }),
		v.object({
			kind: v.literal("new"),
			orgNumber: v.string(),
			displayName: v.string(),
			description: v.string(),
			logo: v.string(),
		}),
	),
	companyChanges: v.optional(
		v.object({
			displayName: v.optional(v.string()),
			description: v.optional(v.string()),
			logo: v.optional(v.string()),
		}),
	),
	productId: v.string(),
	startup: v.boolean(),
	listings: v.array(v.object(orderItemFields)),
	contact: orderContact,
	billing: v.optional(companyBilling),
	note: v.optional(v.string()),
	confirmAmount: v.boolean(),
});

export type OrderFormArgs = Infer<typeof orderFormArgs>;

export function parseOrderForm(
	form: unknown,
	settings: Parameters<typeof jobListingOrderSchema>[0],
	now: number,
): JobListingOrderForm {
	const result = jobListingOrderSchema(settings, osloToday(now)).safeParse(form);
	if (!result.success) {
		throw new ConvexError(result.error.issues[0]?.message ?? "Bestillingen er ugyldig.");
	}
	return result.data;
}

async function requireLogo(ctx: MutationCtx, id: string): Promise<Id<"_storage">> {
	const storageId = ctx.db.system.normalizeId("_storage", id);
	const file = storageId ? await ctx.db.system.get("_storage", storageId) : null;
	if (!storageId || !file) throw new ConvexError("Last opp logoen på nytt.");
	const allowed: readonly string[] = LOGO_CONTENT_TYPES;
	if (!file.contentType || !allowed.includes(file.contentType)) {
		throw new ConvexError("Logoen må være PNG eller SVG.");
	}
	if (file.size > LOGO_MAX_BYTES) throw new ConvexError("Logoen kan være høyst 1 MB.");
	return storageId;
}

async function nextReference(ctx: MutationCtx, now: number): Promise<string> {
	const year = Number(osloToday(now).slice(0, 4));
	const counter = await ctx.db
		.query("jobListingOrderCounters")
		.withIndex("by_year", (q) => q.eq("year", year))
		.unique();
	const next = (counter?.last ?? 0) + 1;
	if (counter) await ctx.db.patch(counter._id, { last: next });
	else await ctx.db.insert("jobListingOrderCounters", { year, last: next });
	return `JL-${year}-${String(next).padStart(4, "0")}`;
}

async function addConfirmation(ctx: MutationCtx, orderId: Id<"jobListingOrders">, token: string) {
	const expiresAt = Date.now() + CONFIRMATION_TTL_MS;
	await ctx.db.insert("jobListingOrderConfirmations", {
		orderId,
		tokenHash: await hashLinkToken(token),
		expiresAt,
	});
	await ctx.scheduler.runAt(expiresAt, internal.jobListingOrders.orders.purgeUnconfirmed, {
		orderId,
	});
}

async function companyChangesFor(
	ctx: MutationCtx,
	company: Doc<"companies">,
	parsed: JobListingOrderForm,
): Promise<CompanyChangesDoc | undefined> {
	const requested = parsed.companyChanges;
	const changes: CompanyChangesDoc = {
		displayName: requested?.displayName,
		description:
			requested?.description === undefined ? undefined : sanitizeRichText(requested.description),
		logo: requested?.logo === undefined ? undefined : await requireLogo(ctx, requested.logo),
		billing: company.billing && parsed.billing ? parsed.billing : undefined,
	};
	const hasChanges = Object.values(changes).some((value) => value !== undefined);
	return hasChanges ? changes : undefined;
}

const insertedOrder = v.object({
	orderId: v.id("jobListingOrders"),
	reference: v.string(),
	email: v.string(),
	companyName: v.string(),
	send: v.boolean(),
});

export const insertOrder = internalMutation({
	args: {
		form: orderFormArgs,
		submissionId: v.string(),
		token: v.string(),
		registryName: v.optional(v.string()),
	},
	returns: insertedOrder,
	handler: async (ctx, { form, submissionId, token, registryName }) => {
		const existing = await ctx.db
			.query("jobListingOrders")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.unique();
		if (existing) {
			const send = existing.status === "awaiting_email";
			if (send) await addConfirmation(ctx, existing._id, token);
			return {
				orderId: existing._id,
				reference: existing.reference,
				email: existing.contact.email,
				companyName: await orderCompanyName(ctx, existing),
				send,
			};
		}

		const now = Date.now();
		const settings = await loadOrderSettings(ctx);
		if (!settings.open) throw new ConvexError("Bestillingsskjemaet er stengt.");
		const parsed = parseOrderForm(form, settings, now);

		const productId = ctx.db.normalizeId("products", parsed.productId);
		const product = productId ? await ctx.db.get(productId) : null;
		if (!product?.active || product.category !== "job_listing") {
			throw new ConvexError("Pakken finnes ikke lenger. Last inn siden på nytt.");
		}

		let companyId: Id<"companies"> | undefined;
		let newCompany: Doc<"jobListingOrders">["newCompany"];
		let companyChanges: CompanyChangesDoc | undefined;
		let companyName: string;
		let companyBillingOnFile: Doc<"companies">["billing"];

		if (parsed.company.kind === "existing") {
			companyId = ctx.db.normalizeId("companies", parsed.company.companyId) ?? undefined;
			const company = companyId ? await ctx.db.get(companyId) : null;
			if (!company) throw new ConvexError("Fant ikke bedriften. Last inn siden på nytt.");
			companyChanges = await companyChangesFor(ctx, company, parsed);
			companyName = company.name;
			companyBillingOnFile = company.billing;
		} else {
			if (!registryName) throw new ConvexError("Fant ikke bedriften i Enhetsregisteret.");
			const orgNumber = Number(parsed.company.orgNumber);
			const registered = await ctx.db
				.query("companies")
				.withIndex("by_orgNumber", (q) => q.eq("orgNumber", orgNumber))
				.first();
			if (registered) {
				throw new ConvexError("Bedriften er allerede registrert. Velg den fra listen.");
			}
			newCompany = {
				orgNumber: parsed.company.orgNumber,
				registryName,
				displayName: parsed.company.displayName,
				description: sanitizeRichText(parsed.company.description),
				logo: await requireLogo(ctx, parsed.company.logo),
			};
			companyName = parsed.company.displayName;
		}

		const billing = parsed.billing ?? companyBillingOnFile;
		if (!billing) throw new ConvexError("Fyll inn fakturainformasjon.");

		const reference = await nextReference(ctx, now);
		const orderId = await ctx.db.insert("jobListingOrders", {
			reference,
			submissionId,
			status: "awaiting_email",
			companyId,
			newCompany,
			companyChanges,
			productId: product._id,
			productName: product.name,
			startup: parsed.startup,
			quantity: parsed.listings.length,
			priceOre: orderPriceOre(product, parsed.listings.length, parsed.startup),
			contact: parsed.contact,
			billing,
			note: parsed.note || undefined,
		});
		for (const [position, listing] of parsed.listings.entries()) {
			await ctx.db.insert("jobListingOrderItems", {
				orderId,
				position,
				...listing,
				description: sanitizeRichText(listing.description),
			});
		}
		await addConfirmation(ctx, orderId, token);

		return {
			orderId,
			reference,
			email: parsed.contact.email,
			companyName,
			send: true,
		};
	},
});

export const addConfirmationToken = internalMutation({
	args: { submissionId: v.string(), token: v.string() },
	returns: v.union(v.null(), insertedOrder),
	handler: async (ctx, { submissionId, token }) => {
		const order = await ctx.db
			.query("jobListingOrders")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.unique();
		if (order?.status !== "awaiting_email") return null;
		await addConfirmation(ctx, order._id, token);
		return {
			orderId: order._id,
			reference: order.reference,
			email: order.contact.email,
			companyName: await orderCompanyName(ctx, order),
			send: true,
		};
	},
});

export async function orderCompanyName(
	ctx: QueryCtx,
	order: Doc<"jobListingOrders">,
): Promise<string> {
	if (order.newCompany) return order.newCompany.displayName;
	const company = order.companyId ? await ctx.db.get(order.companyId) : null;
	return company?.name ?? "";
}

export async function listOrderItems(ctx: QueryCtx, orderId: Id<"jobListingOrders">) {
	return await ctx.db
		.query("jobListingOrderItems")
		.withIndex("by_orderId_and_position", (q) => q.eq("orderId", orderId))
		.take(50);
}

const receipt = v.object({
	reference: v.string(),
	companyName: v.string(),
	productName: v.string(),
	quantity: v.number(),
	priceOre: v.number(),
	contactEmail: v.string(),
	titles: v.array(v.string()),
	updateRequested: v.boolean(),
	feedbackGiven: v.boolean(),
});

async function receiptFor(ctx: QueryCtx, order: Doc<"jobListingOrders">) {
	const items = await listOrderItems(ctx, order._id);
	return {
		reference: order.reference,
		companyName: await orderCompanyName(ctx, order),
		productName: order.productName,
		quantity: order.quantity,
		priceOre: order.priceOre,
		contactEmail: order.contact.email,
		titles: items.map((item) => item.title),
		updateRequested: order.companyChanges !== undefined,
		feedbackGiven: order.feedback !== undefined,
	};
}

async function findConfirmation(ctx: QueryCtx, token: string) {
	const tokenHash = await hashLinkToken(token);
	return await ctx.db
		.query("jobListingOrderConfirmations")
		.withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
		.unique();
}

export const confirm = mutation({
	args: { token: v.string() },
	returns: v.union(
		v.object({ state: v.literal("confirmed"), receipt }),
		v.object({ state: v.literal("expired") }),
		v.object({ state: v.literal("invalid") }),
	),
	handler: async (ctx, { token }) => {
		const confirmation = await findConfirmation(ctx, token);
		const order = confirmation ? await ctx.db.get(confirmation.orderId) : null;
		if (!confirmation || !order) return { state: "invalid" as const };
		if (!confirmation.usedAt && order.status !== "awaiting_email") {
			return { state: "invalid" as const };
		}

		if (!confirmation.usedAt) {
			const now = Date.now();
			if (confirmation.expiresAt <= now) return { state: "expired" as const };
			await ctx.db.patch(confirmation._id, { usedAt: now });
			await ctx.db.patch(order._id, { status: "confirmed", confirmedAt: now });
			if (order.companyId && order.companyChanges) {
				await openUpdateRequest(ctx, order._id, order.companyId, order.companyChanges);
			}
			await ctx.scheduler.runAfter(0, internal.jobListingOrders.emails.sendReceipt, {
				orderId: order._id,
			});
			await ctx.scheduler.runAfter(0, internal.jobListingOrders.emails.sendAdminNotice, {
				orderId: order._id,
			});
		}

		return { state: "confirmed" as const, receipt: await receiptFor(ctx, order) };
	},
});

async function openUpdateRequest(
	ctx: MutationCtx,
	orderId: Id<"jobListingOrders">,
	companyId: Id<"companies">,
	changes: CompanyChangesDoc,
) {
	const company = await ctx.db.get(companyId);
	if (!company) return;
	const logo = await ctx.db.get(company.logo);
	await ctx.db.insert("companyUpdateRequests", {
		companyId,
		orderId,
		changes,
		previous: {
			displayName: changes.displayName === undefined ? undefined : company.name,
			description: changes.description === undefined ? undefined : company.description,
			logo: changes.logo === undefined ? undefined : logo?.image,
			billing: changes.billing === undefined ? undefined : company.billing,
		},
		status: "pending",
	});
}

export const saveFeedback = mutation({
	args: { token: v.string(), feedback: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, feedback }) => {
		const confirmation = await findConfirmation(ctx, token);
		if (!confirmation?.usedAt) throw new ConvexError("Lenken er ugyldig.");
		const limit = await orderRateLimiter.limit(ctx, "jobListingOrderFeedback", {
			key: confirmation.tokenHash,
		});
		if (!limit.ok) throw new ConvexError("Prøv igjen om litt.");
		const trimmed = feedback.trim();
		if (!trimmed) throw new ConvexError("Skriv en tilbakemelding.");
		if (trimmed.length > FEEDBACK_MAX_LENGTH) {
			throw new ConvexError(`Tilbakemeldingen kan ha høyst ${FEEDBACK_MAX_LENGTH} tegn.`);
		}
		await ctx.db.patch(confirmation.orderId, { feedback: trimmed });
		return null;
	},
});

export const purgeUnconfirmed = internalMutation({
	args: { orderId: v.id("jobListingOrders") },
	returns: v.null(),
	handler: async (ctx, { orderId }) => {
		const order = await ctx.db.get(orderId);
		if (order?.status !== "awaiting_email") return null;
		const confirmations = await ctx.db
			.query("jobListingOrderConfirmations")
			.withIndex("by_orderId", (q) => q.eq("orderId", orderId))
			.take(20);
		const now = Date.now();
		if (confirmations.some((confirmation) => confirmation.expiresAt > now)) return null;

		for (const confirmation of confirmations) await ctx.db.delete(confirmation._id);
		for (const item of await listOrderItems(ctx, orderId)) await ctx.db.delete(item._id);
		for (const storageId of [order.newCompany?.logo, order.companyChanges?.logo]) {
			if (storageId) await ctx.storage.delete(storageId);
		}
		await ctx.db.delete(orderId);
		return null;
	},
});

export const emailContext = internalQuery({
	args: { orderId: v.id("jobListingOrders") },
	returns: v.union(
		v.null(),
		v.object({
			reference: v.string(),
			status: v.string(),
			companyName: v.string(),
			productName: v.string(),
			quantity: v.number(),
			priceOre: v.number(),
			contact: orderContact,
			rejectionReason: v.optional(v.string()),
			updateRequested: v.boolean(),
			listings: v.array(
				v.object({
					title: v.string(),
					jobListingId: v.optional(v.id("jobListings")),
				}),
			),
		}),
	),
	handler: async (ctx, { orderId }) => {
		const order = await ctx.db.get(orderId);
		if (!order) return null;
		const items = await listOrderItems(ctx, orderId);
		return {
			reference: order.reference,
			status: order.status,
			companyName: await orderCompanyName(ctx, order),
			productName: order.productName,
			quantity: order.quantity,
			priceOre: order.priceOre,
			contact: order.contact,
			rejectionReason: order.rejectionReason,
			updateRequested: order.companyChanges !== undefined,
			listings: items.map(({ title, jobListingId }) => ({ title, jobListingId })),
		};
	},
});
