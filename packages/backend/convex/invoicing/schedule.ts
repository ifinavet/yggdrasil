import { invoiceDueAt } from "@workspace/shared/time";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { InvoiceSource } from "./schema";

const RESCHEDULABLE = new Set<Doc<"invoices">["status"]>(["scheduled", "failed", "cancelled"]);
const CANCELLABLE = new Set<Doc<"invoices">["status"]>(["scheduled", "failed"]);

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
	const dueAt = invoiceDueAt(serviceAt);
	const existing = await invoiceFor(ctx, source);
	if (!existing) {
		await ctx.db.insert("invoices", {
			source,
			sourceKey: sourceKeyOf(source),
			serviceAt,
			dueAt,
			status: "scheduled",
			attempts: 0,
		});
		return;
	}
	if (!RESCHEDULABLE.has(existing.status)) return;
	await ctx.db.patch(existing._id, {
		serviceAt,
		dueAt,
		status: "scheduled",
		attempts: 0,
		lastError: undefined,
	});
}

export async function cancelInvoice(ctx: MutationCtx, source: InvoiceSource): Promise<void> {
	const existing = await invoiceFor(ctx, source);
	if (!existing || !CANCELLABLE.has(existing.status)) return;
	await ctx.db.patch(existing._id, { status: "cancelled" });
}
