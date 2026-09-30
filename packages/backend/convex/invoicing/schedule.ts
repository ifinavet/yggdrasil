import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { InvoiceSource } from "./schema";

export function sourceKeyOf(source: InvoiceSource): string {
	return source.kind === "jobListingOrder"
		? `jobListingOrder:${source.orderId}`
		: `companyApplication:${source.applicationId}`;
}

export async function invoiceFor(
	ctx: QueryCtx | MutationCtx,
	source: InvoiceSource,
): Promise<Doc<"invoices"> | null> {
	return ctx.db
		.query("invoices")
		.withIndex("by_sourceKey", (q) => q.eq("sourceKey", sourceKeyOf(source)))
		.unique();
}

export async function scheduleInvoice(
	ctx: MutationCtx,
	source: InvoiceSource,
	serviceAt: number,
): Promise<void> {
	const existing = await invoiceFor(ctx, source);
	if (!existing) {
		await ctx.db.insert("invoices", {
			source,
			sourceKey: sourceKeyOf(source),
			serviceAt,
			status: "pending",
		});
		return;
	}
	if (existing.status === "sent") return;
	await ctx.db.patch(existing._id, { serviceAt, status: "pending" });
}

export async function cancelInvoice(ctx: MutationCtx, source: InvoiceSource): Promise<void> {
	const existing = await invoiceFor(ctx, source);
	if (existing?.status === "pending") await ctx.db.patch(existing._id, { status: "cancelled" });
}
