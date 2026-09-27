import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const invoiceSource = v.union(
	v.object({ kind: v.literal("jobListingOrder"), orderId: v.id("jobListingOrders") }),
	v.object({ kind: v.literal("companyApplication"), applicationId: v.id("companyApplications") }),
);

export type InvoiceSource = Infer<typeof invoiceSource>;

export const invoicePlan = v.object({
	customer: v.object({
		name: v.string(),
		organizationNumber: v.string(),
		email: v.optional(v.string()),
	}),
	fikenContactId: v.optional(v.number()),
	invoiceText: v.string(),
	yourReference: v.optional(v.string()),
	line: v.object({
		description: v.string(),
		unitPrice: v.number(),
		vatRate: v.number(),
	}),
});

export type InvoicePlan = Infer<typeof invoicePlan>;

export const invoiceStatus = v.union(
	v.literal("scheduled"),
	v.literal("queued"),
	v.literal("draft_created"),
	v.literal("failed"),
	v.literal("cancelled"),
);

export type InvoiceStatus = Infer<typeof invoiceStatus>;

export const invoicingSchema = {
	invoices: defineTable({
		source: invoiceSource,
		sourceKey: v.string(),
		serviceAt: v.number(),
		dueAt: v.number(),
		status: invoiceStatus,
		attempts: v.number(),
		fikenContactId: v.optional(v.number()),
		fikenDraftId: v.optional(v.number()),
		lastError: v.optional(v.string()),
		queuedAt: v.optional(v.number()),
		draftCreatedAt: v.optional(v.number()),
		sentPlan: v.optional(invoicePlan),
	})
		.index("by_sourceKey", ["sourceKey"])
		.index("by_status_and_dueAt", ["status", "dueAt"]),
};
