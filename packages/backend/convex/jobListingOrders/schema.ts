import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { companyBilling } from "../companies/schema";

export const orderStatus = v.union(
	v.literal("awaiting_email"),
	v.literal("confirmed"),
	v.literal("published"),
	v.literal("rejected"),
);

export type OrderStatus = Infer<typeof orderStatus>;

export const orderContact = v.object({
	name: v.string(),
	email: v.string(),
	phone: v.optional(v.string()),
});

export const newCompany = v.object({
	orgNumber: v.string(),
	registryName: v.string(),
	displayName: v.string(),
	description: v.string(),
	logo: v.id("_storage"),
});

export const companyChanges = v.object({
	displayName: v.optional(v.string()),
	description: v.optional(v.string()),
	logo: v.optional(v.id("_storage")),
	billing: v.optional(companyBilling),
});

export type CompanyChangesDoc = Infer<typeof companyChanges>;

export const orderItemFields = {
	title: v.string(),
	teaser: v.string(),
	description: v.string(),
	applicationUrl: v.string(),
	deadline: v.string(),
	type: v.string(),
};

export const orderSettingsFields = {
	intro: v.string(),
	jobTypes: v.array(v.string()),
	titleMaxLength: v.number(),
	teaserMaxLength: v.number(),
	open: v.boolean(),
};

export const jobListingOrdersSchema = {
	jobListingOrders: defineTable({
		reference: v.string(),
		submissionId: v.string(),
		status: orderStatus,
		companyId: v.optional(v.id("companies")),
		newCompany: v.optional(newCompany),
		companyChanges: v.optional(companyChanges),
		productId: v.id("products"),
		productName: v.string(),
		startup: v.boolean(),
		quantity: v.number(),
		priceOre: v.number(),
		contact: orderContact,
		billing: v.optional(companyBilling),
		note: v.optional(v.string()),
		confirmedAt: v.optional(v.number()),
		decidedAt: v.optional(v.number()),
		decidedBy: v.optional(v.id("users")),
		rejectionReason: v.optional(v.string()),
		feedback: v.optional(v.string()),
	})
		.index("by_submissionId", ["submissionId"])
		.index("by_status", ["status"]),

	jobListingOrderItems: defineTable({
		orderId: v.id("jobListingOrders"),
		position: v.number(),
		...orderItemFields,
		jobListingId: v.optional(v.id("jobListings")),
	}).index("by_orderId_and_position", ["orderId", "position"]),

	jobListingOrderConfirmations: defineTable({
		orderId: v.id("jobListingOrders"),
		tokenHash: v.string(),
		expiresAt: v.number(),
		usedAt: v.optional(v.number()),
	})
		.index("by_tokenHash", ["tokenHash"])
		.index("by_orderId", ["orderId"]),

	companyUpdateRequests: defineTable({
		companyId: v.id("companies"),
		orderId: v.id("jobListingOrders"),
		changes: companyChanges,
		previous: companyChanges,
		status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
		decidedAt: v.optional(v.number()),
		decidedBy: v.optional(v.id("users")),
	})
		.index("by_orderId", ["orderId"])
		.index("by_companyId_and_status", ["companyId", "status"]),

	jobListingOrderCounters: defineTable({
		year: v.number(),
		last: v.number(),
	}).index("by_year", ["year"]),

	jobListingOrderFormVersions: defineTable({
		...orderSettingsFields,
		createdBy: v.id("users"),
	}),
};
