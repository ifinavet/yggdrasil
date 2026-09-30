import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const invoiceSource = v.union(
	v.object({ kind: v.literal("jobListingOrder"), orderId: v.id("jobListingOrders") }),
	v.object({ kind: v.literal("companyApplication"), applicationId: v.id("companyApplications") }),
);

export type InvoiceSource = Infer<typeof invoiceSource>;

export const invoiceDetails = v.object({
	customer: v.object({
		name: v.string(),
		organizationNumber: v.string(),
		email: v.optional(v.string()),
		billingDetails: v.optional(v.string()),
		ehfInvoice: v.optional(v.boolean()),
	}),
	invoiceText: v.string(),
	yourReference: v.optional(v.string()),
	line: v.object({
		description: v.string(),
		unitPrice: v.number(),
		vatRate: v.number(),
	}),
});

export type InvoiceDetails = Infer<typeof invoiceDetails>;

export const invoiceStatus = v.union(
	v.literal("pending"),
	v.literal("sent"),
	v.literal("cancelled"),
);

export type InvoiceStatus = Infer<typeof invoiceStatus>;

export const invoicingSchema = {
	invoices: defineTable({
		source: invoiceSource,
		sourceKey: v.string(),
		serviceAt: v.number(),
		status: invoiceStatus,
		sentAt: v.optional(v.number()),
		sentBy: v.optional(v.id("users")),
		sentDetails: v.optional(invoiceDetails),
	})
		.index("by_sourceKey", ["sourceKey"])
		.index("by_status_and_serviceAt", ["status", "serviceAt"])
		.index("by_status_and_sentAt", ["status", "sentAt"]),
};
