import { DEFAULT_VAT_RATE } from "@workspace/shared/products";
import { osloToday } from "@workspace/shared/time";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { InvoiceDetails } from "./schema";

export type InvoiceResolution =
	| { kind: "ready"; details: InvoiceDetails; serviceAt: number }
	| { kind: "cancel" }
	| { kind: "fail"; error: string };

export async function resolveInvoice(
	ctx: QueryCtx,
	invoice: Doc<"invoices">,
): Promise<InvoiceResolution> {
	if (invoice.status === "sent" && invoice.sentDetails) {
		return { kind: "ready", details: invoice.sentDetails, serviceAt: invoice.serviceAt };
	}

	if (invoice.source.kind === "jobListingOrder") {
		const order = await ctx.db.get(invoice.source.orderId);
		if (order?.status !== "published" || !order.companyId) return { kind: "cancel" };
		const company = await ctx.db.get(order.companyId);
		if (!company) return { kind: "fail", error: "Fant ikke bedriften til bestillingen." };
		const product = await ctx.db.get(order.productId);
		return {
			kind: "ready",
			serviceAt: invoice.serviceAt,
			details: {
				customer: {
					name: company.registryName ?? company.name,
					organizationNumber: String(company.orgNumber),
					email: order.billing?.email ?? company.billing?.email,
					billingDetails: order.billing?.address ?? company.billing?.address,
					ehfInvoice: order.ehfInvoice,
				},
				invoiceText: `Stillingsannonser, bestilling ${order.reference}`,
				yourReference: order.billing?.reference || company.billing?.reference,
				line: {
					description: `${order.productName} (${order.quantity} stk.)`,
					unitPrice: order.priceOre,
					vatRate: product?.vatRate ?? DEFAULT_VAT_RATE,
				},
			},
		};
	}

	const application = await ctx.db.get(invoice.source.applicationId);
	const event = application?.eventId ? await ctx.db.get(application.eventId) : null;
	if (application?.status !== "confirmed" || !event) return { kind: "cancel" };
	const product = event.product
		? await ctx.db.get(event.product.productId)
		: await ctx.db
				.query("products")
				.withIndex("by_eventType_and_active", (q) =>
					q.eq("eventType", application.eventType).eq("active", true),
				)
				.first();
	const unitPrice = event.product?.unitPriceOre ?? product?.unitPriceOre;
	if (!product || unitPrice === undefined) {
		return { kind: "fail", error: "Arrangementet mangler et produkt med pris." };
	}
	return {
		kind: "ready",
		serviceAt: event.eventStart,
		details: {
			customer: {
				name: application.registry.name,
				organizationNumber: application.orgNumber,
				email: application.billing.email,
				billingDetails: application.billing.details,
				ehfInvoice: application.billing.ehfInvoice,
			},
			invoiceText: `${event.title}, ${osloToday(event.eventStart)}`,
			line: {
				description: event.product?.name ?? product.name,
				unitPrice,
				vatRate: product.vatRate,
			},
		},
	};
}
