import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { orderCompanyName } from "../jobListingOrders/orders";
import { enqueueInvoice } from "./processing";
import { invoiceStatus } from "./schema";

const LIST_LIMIT = 100;

async function companyNameOf(ctx: QueryCtx, invoice: Doc<"invoices">): Promise<string> {
	if (invoice.source.kind === "jobListingOrder") {
		const order = await ctx.db.get(invoice.source.orderId);
		return order ? await orderCompanyName(ctx, order) : "";
	}
	const application = await ctx.db.get(invoice.source.applicationId);
	return application?.registry.name ?? "";
}

export const list = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("invoices"),
			kind: v.union(v.literal("jobListingOrder"), v.literal("companyApplication")),
			companyName: v.string(),
			serviceAt: v.number(),
			dueAt: v.number(),
			status: invoiceStatus,
			fikenDraftId: v.optional(v.number()),
			lastError: v.optional(v.string()),
		}),
	),
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		const invoices = await ctx.db.query("invoices").order("desc").take(LIST_LIMIT);
		return await Promise.all(
			invoices.map(async (invoice) => ({
				_id: invoice._id,
				kind: invoice.source.kind,
				companyName: await companyNameOf(ctx, invoice),
				serviceAt: invoice.serviceAt,
				dueAt: invoice.dueAt,
				status: invoice.status,
				fikenDraftId: invoice.fikenDraftId,
				lastError: invoice.lastError,
			})),
		);
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
