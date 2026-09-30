import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { orderCompanyName } from "../jobListingOrders/orders";
import { type InvoiceResolution, resolveInvoice } from "./details";
import { invoiceDetails, invoiceStatus } from "./schema";

const invoiceSummary = v.object({
	_id: v.id("invoices"),
	kind: v.union(v.literal("jobListingOrder"), v.literal("companyApplication")),
	companyName: v.string(),
	invoiceText: v.optional(v.string()),
	serviceAt: v.number(),
	status: invoiceStatus,
	sentAt: v.optional(v.number()),
	amountOre: v.optional(v.number()),
	issue: v.optional(v.string()),
});

const invoicePreview = v.union(
	v.object({ kind: v.literal("ready"), details: invoiceDetails, serviceAt: v.number() }),
	v.object({ kind: v.literal("cancel") }),
	v.object({ kind: v.literal("fail"), error: v.string() }),
);

async function companyNameOf(ctx: QueryCtx, invoice: Doc<"invoices">): Promise<string> {
	if (invoice.source.kind === "jobListingOrder") {
		const order = await ctx.db.get(invoice.source.orderId);
		return order ? await orderCompanyName(ctx, order) : "";
	}
	const application = await ctx.db.get(invoice.source.applicationId);
	return application?.registry.name ?? "";
}

async function summarize(ctx: QueryCtx, invoice: Doc<"invoices">, preview: InvoiceResolution) {
	return {
		_id: invoice._id,
		kind: invoice.source.kind,
		companyName:
			invoice.status === "sent" && preview.kind === "ready"
				? preview.details.customer.name
				: await companyNameOf(ctx, invoice),
		invoiceText: preview.kind === "ready" ? preview.details.invoiceText : undefined,
		serviceAt: preview.kind === "ready" ? preview.serviceAt : invoice.serviceAt,
		status: invoice.status,
		sentAt: invoice.sentAt,
		amountOre: preview.kind === "ready" ? preview.details.line.unitPrice : undefined,
		issue:
			preview.kind === "fail"
				? preview.error
				: preview.kind === "cancel" && invoice.status === "pending"
					? "Grunnlaget er ikke lenger aktivt."
					: undefined,
	};
}

export const list = query({
	args: { status: invoiceStatus, paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(invoiceSummary),
	handler: async (ctx, { status, paginationOpts }) => {
		await requireRole(ctx, adminRoles);
		const invoices =
			status === "sent"
				? ctx.db
						.query("invoices")
						.withIndex("by_status_and_sentAt", (q) => q.eq("status", status))
						.order("desc")
				: ctx.db
						.query("invoices")
						.withIndex("by_status_and_serviceAt", (q) => q.eq("status", status))
						.order(status === "pending" ? "asc" : "desc");
		const page = await invoices.paginate(paginationOpts);
		return {
			...page,
			page: await Promise.all(
				page.page.map(async (invoice) =>
					summarize(ctx, invoice, await resolveInvoice(ctx, invoice)),
				),
			),
		};
	},
});

export const get = query({
	args: { invoiceId: v.id("invoices") },
	returns: v.union(v.null(), v.object({ invoice: invoiceSummary, preview: invoicePreview })),
	handler: async (ctx, { invoiceId }) => {
		await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (!invoice) return null;
		const preview = await resolveInvoice(ctx, invoice);
		return { invoice: await summarize(ctx, invoice, preview), preview };
	},
});

export const markSent = mutation({
	args: { invoiceId: v.id("invoices") },
	returns: v.null(),
	handler: async (ctx, { invoiceId }) => {
		const user = await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (invoice?.status !== "pending") throw new ConvexError("Fakturaen er ikke klar til merking.");
		const preview = await resolveInvoice(ctx, invoice);
		if (preview.kind !== "ready") throw new ConvexError("Fakturagrunnlaget må være komplett.");
		if (preview.serviceAt > Date.now()) {
			throw new ConvexError("Leveransen må være fullført før fakturaen kan merkes som sendt.");
		}
		await ctx.db.patch(invoiceId, {
			status: "sent",
			serviceAt: preview.serviceAt,
			sentAt: Date.now(),
			sentBy: user._id,
			sentDetails: preview.details,
		});
		return null;
	},
});

export const markUnsent = mutation({
	args: { invoiceId: v.id("invoices") },
	returns: v.null(),
	handler: async (ctx, { invoiceId }) => {
		await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (invoice?.status !== "sent") throw new ConvexError("Bare sendte fakturaer kan åpnes igjen.");
		await ctx.db.patch(invoiceId, {
			status: "pending",
			sentAt: undefined,
			sentBy: undefined,
			sentDetails: undefined,
		});
		return null;
	},
});

export const cancel = mutation({
	args: { invoiceId: v.id("invoices") },
	returns: v.null(),
	handler: async (ctx, { invoiceId }) => {
		await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (invoice?.status !== "pending") {
			throw new ConvexError("Bare fakturaer som ikke er sendt kan avbrytes.");
		}
		await ctx.db.patch(invoiceId, { status: "cancelled" });
		return null;
	},
});
