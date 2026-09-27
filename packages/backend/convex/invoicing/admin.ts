import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { orderCompanyName } from "../jobListingOrders/orders";
import { enqueueInvoice, invoicePlan, resolvePlan } from "./processing";
import { invoiceStatus } from "./schema";

const LIST_LIMIT = 100;
const PREVIEW_STATUSES = new Set<Doc<"invoices">["status"]>(["scheduled", "queued", "failed"]);
const CANCELLABLE_STATUSES = new Set<Doc<"invoices">["status"]>(["scheduled", "failed"]);

const invoiceSummary = v.object({
	_id: v.id("invoices"),
	kind: v.union(v.literal("jobListingOrder"), v.literal("companyApplication")),
	companyName: v.string(),
	serviceAt: v.number(),
	dueAt: v.number(),
	status: invoiceStatus,
	fikenDraftId: v.optional(v.number()),
	lastError: v.optional(v.string()),
});

const invoicePreview = v.union(
	v.object({ kind: v.literal("ready"), plan: invoicePlan }),
	v.object({ kind: v.literal("cancel") }),
	v.object({ kind: v.literal("reschedule"), serviceAt: v.number() }),
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

async function summarize(ctx: QueryCtx, invoice: Doc<"invoices">) {
	return {
		_id: invoice._id,
		kind: invoice.source.kind,
		companyName: await companyNameOf(ctx, invoice),
		serviceAt: invoice.serviceAt,
		dueAt: invoice.dueAt,
		status: invoice.status,
		fikenDraftId: invoice.fikenDraftId,
		lastError: invoice.lastError,
	};
}

export const list = query({
	args: {},
	returns: v.array(invoiceSummary),
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		const invoices = await ctx.db.query("invoices").order("desc").take(LIST_LIMIT);
		return await Promise.all(invoices.map((invoice) => summarize(ctx, invoice)));
	},
});

export const get = query({
	args: { invoiceId: v.id("invoices") },
	returns: v.union(
		v.null(),
		v.object({
			invoice: invoiceSummary,
			attempts: v.number(),
			draftCreatedAt: v.optional(v.number()),
			preview: v.union(v.null(), invoicePreview),
		}),
	),
	handler: async (ctx, { invoiceId }) => {
		await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (!invoice) return null;
		return {
			invoice: await summarize(ctx, invoice),
			attempts: invoice.attempts,
			draftCreatedAt: invoice.draftCreatedAt,
			preview: PREVIEW_STATUSES.has(invoice.status) ? await resolvePlan(ctx, invoice) : null,
		};
	},
});

export const retry = mutation({
	args: { invoiceId: v.id("invoices") },
	returns: v.null(),
	handler: async (ctx, { invoiceId }) => {
		await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (invoice?.status !== "failed") {
			throw new ConvexError("Bare fakturaer som feilet kan prøves på nytt.");
		}
		await enqueueInvoice(ctx, { ...invoice, attempts: 0 });
		return null;
	},
});

export const cancel = mutation({
	args: { invoiceId: v.id("invoices") },
	returns: v.null(),
	handler: async (ctx, { invoiceId }) => {
		await requireRole(ctx, adminRoles);
		const invoice = await ctx.db.get(invoiceId);
		if (!invoice || !CANCELLABLE_STATUSES.has(invoice.status)) {
			throw new ConvexError("Bare planlagte eller feilede fakturaer kan avbrytes.");
		}
		await ctx.db.patch(invoiceId, { status: "cancelled" });
		return null;
	},
});
