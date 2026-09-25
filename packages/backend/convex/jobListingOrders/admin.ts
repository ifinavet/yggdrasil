import { orderListingSchema } from "@workspace/shared/job-listing-orders";
import { osloDateTimeToEpoch, osloToday } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { findCompanyLogoUrl } from "../companies/helper";
import { companyBilling } from "../companies/schema";
import { listOrderItems, orderCompanyName } from "./orders";
import { sanitizeRichText } from "./sanitize";
import { orderContact, orderItemFields, orderStatus } from "./schema";
import { loadOrderSettings } from "./settings";

const PENDING_LIMIT = 50;
const REJECTION_MAX_LENGTH = 1000;
const DEADLINE_CLOCK = "23:59";

async function pendingUpdateFor(ctx: QueryCtx, orderId: Id<"jobListingOrders">) {
	const requests = await ctx.db
		.query("companyUpdateRequests")
		.withIndex("by_orderId", (q) => q.eq("orderId", orderId))
		.take(10);
	return requests.find((request) => request.status === "pending") ?? null;
}

export const listPending = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("jobListingOrders"),
			reference: v.string(),
			companyName: v.string(),
			quantity: v.number(),
			confirmedAt: v.optional(v.number()),
			updatePending: v.boolean(),
			newCompany: v.boolean(),
		}),
	),
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const orders = await ctx.db
			.query("jobListingOrders")
			.withIndex("by_status", (q) => q.eq("status", "confirmed"))
			.take(PENDING_LIMIT);
		return await Promise.all(
			orders.map(async (order) => ({
				_id: order._id,
				reference: order.reference,
				companyName: await orderCompanyName(ctx, order),
				quantity: order.quantity,
				confirmedAt: order.confirmedAt,
				updatePending: (await pendingUpdateFor(ctx, order._id)) !== null,
				newCompany: order.newCompany !== undefined,
			})),
		);
	},
});

const companyView = v.object({
	name: v.string(),
	registryName: v.optional(v.string()),
	orgNumber: v.string(),
	description: v.string(),
	logoUrl: v.union(v.string(), v.null()),
	billing: v.optional(companyBilling),
});

const changesView = v.object({
	displayName: v.optional(v.string()),
	description: v.optional(v.string()),
	logoUrl: v.optional(v.union(v.string(), v.null())),
	billing: v.optional(companyBilling),
});

async function viewChanges(ctx: QueryCtx, changes: Doc<"companyUpdateRequests">["changes"]) {
	return {
		displayName: changes.displayName,
		description: changes.description,
		logoUrl: changes.logo ? await ctx.storage.getUrl(changes.logo) : undefined,
		billing: changes.billing,
	};
}

async function viewCompany(ctx: QueryCtx, order: Doc<"jobListingOrders">) {
	if (order.newCompany) {
		return {
			name: order.newCompany.displayName,
			registryName: order.newCompany.registryName,
			orgNumber: order.newCompany.orgNumber,
			description: order.newCompany.description,
			logoUrl: await ctx.storage.getUrl(order.newCompany.logo),
			billing: order.billing,
		};
	}
	const company = order.companyId ? await ctx.db.get(order.companyId) : null;
	if (!company) return null;
	return {
		name: company.name,
		registryName: company.registryName,
		orgNumber: String(company.orgNumber),
		description: company.description,
		logoUrl: await findCompanyLogoUrl(ctx, company._id),
		billing: company.billing,
	};
}

export const getOrder = query({
	args: { orderId: v.id("jobListingOrders") },
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("jobListingOrders"),
			reference: v.string(),
			status: orderStatus,
			productName: v.string(),
			startup: v.boolean(),
			quantity: v.number(),
			priceOre: v.number(),
			contact: orderContact,
			billing: v.optional(companyBilling),
			note: v.optional(v.string()),
			feedback: v.optional(v.string()),
			confirmedAt: v.optional(v.number()),
			isNewCompany: v.boolean(),
			company: v.union(v.null(), companyView),
			update: v.union(
				v.null(),
				v.object({
					_id: v.id("companyUpdateRequests"),
					status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
					changes: changesView,
					previous: changesView,
				}),
			),
			items: v.array(
				v.object({
					_id: v.id("jobListingOrderItems"),
					position: v.number(),
					...orderItemFields,
				}),
			),
		}),
	),
	handler: async (ctx, { orderId }) => {
		await requireRole(ctx, internalRoles);
		const order = await ctx.db.get(orderId);
		if (!order) return null;
		const request = await ctx.db
			.query("companyUpdateRequests")
			.withIndex("by_orderId", (q) => q.eq("orderId", orderId))
			.order("desc")
			.first();
		const items = await listOrderItems(ctx, orderId);
		return {
			_id: order._id,
			reference: order.reference,
			status: order.status,
			productName: order.productName,
			startup: order.startup,
			quantity: order.quantity,
			priceOre: order.priceOre,
			contact: order.contact,
			billing: order.billing,
			note: order.note,
			feedback: order.feedback,
			confirmedAt: order.confirmedAt,
			isNewCompany: order.newCompany !== undefined,
			company: await viewCompany(ctx, order),
			update: request
				? {
						_id: request._id,
						status: request.status,
						changes: await viewChanges(ctx, request.changes),
						previous: await viewChanges(ctx, request.previous),
					}
				: null,
			items: items.map(
				({ _id, position, title, teaser, description, applicationUrl, deadline, type }) => ({
					_id,
					position,
					title,
					teaser,
					description,
					applicationUrl,
					deadline,
					type,
				}),
			),
		};
	},
});

async function requireConfirmedOrder(ctx: MutationCtx, orderId: Id<"jobListingOrders">) {
	const order = await ctx.db.get(orderId);
	if (order?.status !== "confirmed") {
		throw new ConvexError("Bestillingen er allerede behandlet.");
	}
	return order;
}

async function applyCompanyChanges(ctx: MutationCtx, request: Doc<"companyUpdateRequests">) {
	const company = await ctx.db.get(request.companyId);
	if (!company) throw new ConvexError("Fant ikke bedriften.");
	const { displayName, description, logo, billing } = request.changes;
	const logoId = logo
		? await ctx.db.insert("companyLogos", { name: `${company.name} logo`, image: logo })
		: undefined;
	await ctx.db.patch(company._id, {
		...(displayName === undefined ? {} : { name: displayName }),
		...(description === undefined ? {} : { description }),
		...(logoId === undefined ? {} : { logo: logoId }),
		...(billing === undefined ? {} : { billing }),
	});
}

export const decideUpdate = mutation({
	args: { requestId: v.id("companyUpdateRequests"), approve: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { requestId, approve }) => {
		const user = await requireRole(ctx, internalRoles);
		const request = await ctx.db.get(requestId);
		if (request?.status !== "pending") throw new ConvexError("Endringen er allerede behandlet.");
		if (approve) await applyCompanyChanges(ctx, request);
		else if (request.changes.logo) await ctx.storage.delete(request.changes.logo);
		await ctx.db.patch(requestId, {
			status: approve ? "approved" : "rejected",
			decidedAt: Date.now(),
			decidedBy: user._id,
		});
		return null;
	},
});

async function companyForPublishing(ctx: MutationCtx, order: Doc<"jobListingOrders">) {
	if (order.companyId) {
		const company = await ctx.db.get(order.companyId);
		if (!company) throw new ConvexError("Fant ikke bedriften.");
		if (!company.billing && order.billing) {
			await ctx.db.patch(company._id, { billing: order.billing });
		}
		return company._id;
	}
	const draft = order.newCompany;
	if (!draft) throw new ConvexError("Bestillingen mangler bedrift.");
	const orgNumber = Number(draft.orgNumber);
	const registered = await ctx.db
		.query("companies")
		.withIndex("by_orgNumber", (q) => q.eq("orgNumber", orgNumber))
		.first();
	if (registered) return registered._id;
	const logo = await ctx.db.insert("companyLogos", {
		name: `${draft.displayName} logo`,
		image: draft.logo,
	});
	return await ctx.db.insert("companies", {
		orgNumber,
		name: draft.displayName,
		registryName: draft.registryName,
		description: draft.description,
		mainSponsor: false,
		logo,
		billing: order.billing,
	});
}

export const approve = mutation({
	args: { orderId: v.id("jobListingOrders") },
	returns: v.null(),
	handler: async (ctx, { orderId }) => {
		const user = await requireRole(ctx, internalRoles);
		const order = await requireConfirmedOrder(ctx, orderId);
		if (await pendingUpdateFor(ctx, orderId)) {
			throw new ConvexError("Godkjenn eller avvis endringen i bedriftsinformasjonen først.");
		}
		const companyId = await companyForPublishing(ctx, order);
		for (const item of await listOrderItems(ctx, orderId)) {
			const listingId = await ctx.db.insert("jobListings", {
				title: item.title,
				type: item.type,
				teaser: item.teaser,
				description: item.description,
				applicationUrl: item.applicationUrl,
				published: true,
				company: companyId,
				deadline: osloDateTimeToEpoch(item.deadline, DEADLINE_CLOCK),
			});
			await ctx.db.insert("jobListingContacts", {
				listingId,
				name: order.contact.name,
				email: order.contact.email,
				phone: order.contact.phone,
			});
			await ctx.db.patch(item._id, { jobListingId: listingId });
		}
		await ctx.db.patch(orderId, {
			status: "published",
			companyId,
			decidedAt: Date.now(),
			decidedBy: user._id,
		});
		await ctx.scheduler.runAfter(0, internal.jobListingOrders.emails.sendPublished, { orderId });
		return null;
	},
});

export const reject = mutation({
	args: { orderId: v.id("jobListingOrders"), reason: v.string() },
	returns: v.null(),
	handler: async (ctx, { orderId, reason }) => {
		const user = await requireRole(ctx, internalRoles);
		await requireConfirmedOrder(ctx, orderId);
		const trimmed = reason.trim();
		if (!trimmed) throw new ConvexError("Skriv en begrunnelse.");
		if (trimmed.length > REJECTION_MAX_LENGTH) {
			throw new ConvexError(`Begrunnelsen kan ha høyst ${REJECTION_MAX_LENGTH} tegn.`);
		}
		const now = Date.now();
		const pending = await pendingUpdateFor(ctx, orderId);
		if (pending) {
			await ctx.db.patch(pending._id, { status: "rejected", decidedAt: now, decidedBy: user._id });
		}
		await ctx.db.patch(orderId, {
			status: "rejected",
			rejectionReason: trimmed,
			decidedAt: now,
			decidedBy: user._id,
		});
		await ctx.scheduler.runAfter(0, internal.jobListingOrders.emails.sendRejected, { orderId });
		return null;
	},
});

export const updateItem = mutation({
	args: { itemId: v.id("jobListingOrderItems"), ...orderItemFields },
	returns: v.null(),
	handler: async (ctx, { itemId, ...fields }) => {
		await requireRole(ctx, internalRoles);
		const item = await ctx.db.get(itemId);
		if (!item) throw new ConvexError("Fant ikke annonsen.");
		await requireConfirmedOrder(ctx, item.orderId);
		const settings = await loadOrderSettings(ctx);
		const parsed = orderListingSchema(settings, osloToday(Date.now())).safeParse(fields);
		if (!parsed.success) {
			throw new ConvexError(parsed.error.issues[0]?.message ?? "Annonsen er ugyldig.");
		}
		await ctx.db.patch(itemId, {
			...parsed.data,
			description: sanitizeRichText(parsed.data.description),
		});
		return null;
	},
});
