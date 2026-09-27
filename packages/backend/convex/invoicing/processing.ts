import { Workpool } from "@convex-dev/workpool";
import { DEFAULT_VAT_RATE } from "@workspace/shared/products";
import { HOUR_MS, invoiceDueAt, osloToday } from "@workspace/shared/time";
import { type Infer, v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	type ActionCtx,
	internalAction,
	internalMutation,
	type MutationCtx,
	type QueryCtx,
} from "../_generated/server";
import {
	createCustomer,
	createInvoiceDraft,
	type FikenConfig,
	type FikenContact,
	FikenError,
	fikenConfig,
	fikenConfigured,
	findCustomerId,
	vatTypeFor,
} from "./fiken";

const MAX_ATTEMPTS = 3;
const SWEEP_BATCH = 50;
const DAYS_UNTIL_DUE = 14;
const DESCRIPTION_MAX_LENGTH = 200;

export const fikenPool = new Workpool(components.fikenWorkpool, { maxParallelism: 1 });

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

export type Resolution =
	| { kind: "ready"; plan: InvoicePlan }
	| { kind: "cancel" }
	| { kind: "reschedule"; serviceAt: number }
	| { kind: "fail"; error: string };

export async function enqueueInvoice(ctx: MutationCtx, invoice: Doc<"invoices">): Promise<void> {
	await ctx.db.patch(invoice._id, {
		status: "queued",
		attempts: invoice.attempts + 1,
		queuedAt: Date.now(),
	});
	await fikenPool.enqueueAction(ctx, internal.invoicing.processing.createDraft, {
		invoiceId: invoice._id,
	});
}

export const sweep = internalMutation({
	args: { asOf: v.optional(v.number()) },
	returns: v.number(),
	handler: async (ctx, { asOf }) => {
		if (!fikenConfigured()) return 0;
		const due = await ctx.db
			.query("invoices")
			.withIndex("by_status_and_dueAt", (q) =>
				q.eq("status", "scheduled").lte("dueAt", asOf ?? Date.now()),
			)
			.take(SWEEP_BATCH);
		for (const invoice of due) await enqueueInvoice(ctx, invoice);
		if (due.length === SWEEP_BATCH) {
			await ctx.scheduler.runAfter(0, internal.invoicing.processing.sweep, { asOf });
		}
		return due.length;
	},
});

async function jobListingOrderPlan(
	ctx: QueryCtx,
	orderId: Id<"jobListingOrders">,
): Promise<Resolution> {
	const order = await ctx.db.get(orderId);
	if (order?.status !== "published" || !order.companyId) return { kind: "cancel" };
	const company = await ctx.db.get(order.companyId);
	if (!company) return { kind: "fail", error: "Fant ikke bedriften til bestillingen." };
	const product = await ctx.db.get(order.productId);
	return {
		kind: "ready",
		plan: {
			customer: {
				name: company.registryName ?? company.name,
				organizationNumber: String(company.orgNumber),
				email: order.billing?.email ?? company.billing?.email,
			},
			invoiceText: `Stillingsannonser, bestilling ${order.reference}`,
			yourReference: order.billing?.reference ?? company.billing?.reference,
			line: {
				description: `${order.productName} (${order.quantity} stk.)`,
				unitPrice: order.priceOre,
				vatRate: product?.vatRate ?? DEFAULT_VAT_RATE,
			},
		},
	};
}

async function companyApplicationPlan(
	ctx: QueryCtx,
	invoice: Doc<"invoices">,
	applicationId: Id<"companyApplications">,
): Promise<Resolution> {
	const application = await ctx.db.get(applicationId);
	const event = application?.eventId ? await ctx.db.get(application.eventId) : null;
	if (application?.status !== "confirmed" || !event) return { kind: "cancel" };
	if (invoiceDueAt(event.eventStart) > invoice.dueAt) {
		return { kind: "reschedule", serviceAt: event.eventStart };
	}
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
		plan: {
			customer: {
				name: application.registry.name,
				organizationNumber: application.orgNumber,
				email: application.billing.email,
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

export async function resolvePlan(ctx: QueryCtx, invoice: Doc<"invoices">): Promise<Resolution> {
	return invoice.source.kind === "jobListingOrder"
		? await jobListingOrderPlan(ctx, invoice.source.orderId)
		: await companyApplicationPlan(ctx, invoice, invoice.source.applicationId);
}

export const prepare = internalMutation({
	args: { invoiceId: v.id("invoices") },
	returns: v.union(v.null(), invoicePlan),
	handler: async (ctx, { invoiceId }) => {
		const invoice = await ctx.db.get(invoiceId);
		if (invoice?.status !== "queued") return null;
		const resolution = await resolvePlan(ctx, invoice);
		switch (resolution.kind) {
			case "ready":
				return { ...resolution.plan, fikenContactId: invoice.fikenContactId };
			case "cancel":
				await ctx.db.patch(invoiceId, { status: "cancelled" });
				return null;
			case "reschedule":
				await ctx.db.patch(invoiceId, {
					status: "scheduled",
					serviceAt: resolution.serviceAt,
					dueAt: invoiceDueAt(resolution.serviceAt),
					attempts: 0,
				});
				return null;
			case "fail":
				await ctx.db.patch(invoiceId, { status: "failed", lastError: resolution.error });
				return null;
		}
	},
});

export const recordContact = internalMutation({
	args: { invoiceId: v.id("invoices"), fikenContactId: v.number() },
	handler: async (ctx, { invoiceId, fikenContactId }) => {
		await ctx.db.patch(invoiceId, { fikenContactId });
	},
});

export const recordDraft = internalMutation({
	args: { invoiceId: v.id("invoices"), fikenDraftId: v.number() },
	handler: async (ctx, { invoiceId, fikenDraftId }) => {
		await ctx.db.patch(invoiceId, {
			status: "draft_created",
			fikenDraftId,
			draftCreatedAt: Date.now(),
			lastError: undefined,
		});
	},
});

export const recordFailure = internalMutation({
	args: { invoiceId: v.id("invoices"), error: v.string(), retryable: v.boolean() },
	handler: async (ctx, { invoiceId, error, retryable }) => {
		const invoice = await ctx.db.get(invoiceId);
		if (!invoice) return;
		if (retryable && invoice.attempts < MAX_ATTEMPTS) {
			await ctx.db.patch(invoiceId, {
				status: "scheduled",
				dueAt: Date.now() + invoice.attempts * HOUR_MS,
				lastError: error,
			});
			return;
		}
		await ctx.db.patch(invoiceId, { status: "failed", lastError: error });
	},
});

async function resolveCustomer(
	ctx: ActionCtx,
	invoiceId: Id<"invoices">,
	config: FikenConfig,
	customer: FikenContact,
): Promise<number> {
	const fikenContactId =
		(await findCustomerId(config, customer.organizationNumber)) ??
		(await createCustomer(config, customer));
	await ctx.runMutation(internal.invoicing.processing.recordContact, { invoiceId, fikenContactId });
	return fikenContactId;
}

export const createDraft = internalAction({
	args: { invoiceId: v.id("invoices") },
	handler: async (ctx, { invoiceId }) => {
		const plan: InvoicePlan | null = await ctx.runMutation(internal.invoicing.processing.prepare, {
			invoiceId,
		});
		if (!plan) return;
		try {
			const config = fikenConfig();
			const vatType = vatTypeFor(plan.line.vatRate);
			const customerId =
				plan.fikenContactId ?? (await resolveCustomer(ctx, invoiceId, config, plan.customer));
			const fikenDraftId = await createInvoiceDraft(config, {
				customerId,
				issueDate: osloToday(Date.now()),
				daysUntilDueDate: DAYS_UNTIL_DUE,
				invoiceText: plan.invoiceText,
				yourReference: plan.yourReference,
				lines: [
					{
						description: plan.line.description.slice(0, DESCRIPTION_MAX_LENGTH),
						unitPrice: plan.line.unitPrice,
						quantity: 1,
						vatType,
					},
				],
			});
			await ctx.runMutation(internal.invoicing.processing.recordDraft, { invoiceId, fikenDraftId });
		} catch (error) {
			await ctx.runMutation(internal.invoicing.processing.recordFailure, {
				invoiceId,
				error: error instanceof Error ? error.message : String(error),
				retryable: error instanceof FikenError && error.retryable,
			});
		}
	},
});
