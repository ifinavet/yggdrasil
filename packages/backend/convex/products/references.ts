import { EVENT_TYPES, type EventType } from "@workspace/shared/semester/labels";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { migrations } from "../migrations";
import { productForType } from "./helpers";

type Found = Doc<"products"> | string;
type Answers = Doc<"eventPlanning">["answers"];
type Fill<T extends TableNames> = { patch: Partial<Doc<T>>; missing: string[] };

const REPORT_LIMIT = 2000;

async function activeProducts(ctx: QueryCtx, eventType: EventType) {
	return await ctx.db
		.query("products")
		.withIndex("by_eventType_and_active", (q) => q.eq("eventType", eventType).eq("active", true))
		.take(2);
}

async function onlyActiveProduct(ctx: QueryCtx, eventType: EventType): Promise<Found> {
	const [first, second] = await activeProducts(ctx, eventType);
	if (!first) return "no active product has this type";
	return second ? "several active products have this type" : first;
}

async function taggedProduct(ctx: QueryCtx, eventId: Id<"events"> | undefined) {
	const event = eventId ? await ctx.db.get(eventId) : null;
	return event?.product && !event.productGuessed ? await ctx.db.get(event.product.productId) : null;
}

export async function applicationProduct(
	ctx: QueryCtx,
	application: Pick<Doc<"companyApplications">, "productId" | "eventId" | "eventType">,
): Promise<Found> {
	const own = application.productId ? await ctx.db.get(application.productId) : null;
	if (own) return own;
	const tagged = await taggedProduct(ctx, application.eventId);
	if (!tagged) return await onlyActiveProduct(ctx, application.eventType);
	return tagged.eventType === application.eventType
		? tagged
		: "the event is tagged with a product of another type";
}

export async function planningProduct(
	ctx: QueryCtx,
	eventId: Id<"events">,
	eventType: EventType,
): Promise<Found> {
	const order = await ctx.db
		.query("companyApplications")
		.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
		.first();
	if (order?.eventType === eventType) return await applicationProduct(ctx, order);
	const tagged = await taggedProduct(ctx, eventId);
	return tagged?.eventType === eventType ? tagged : await onlyActiveProduct(ctx, eventType);
}

export async function orFirstActive(ctx: QueryCtx, found: Found, eventType: EventType) {
	return typeof found === "string" ? await productForType(ctx, eventType) : found;
}

function filled<T extends TableNames>(
	found: Found,
	patch: (productId: Id<"products">) => Partial<Doc<T>>,
	label = "",
): Fill<T> {
	return typeof found === "string"
		? { patch: {}, missing: [label + found] }
		: { patch: patch(found._id), missing: [] };
}

async function requested(ctx: QueryCtx, answers: Answers, label: string) {
	if (!answers.requestedEventType || answers.requestedProductId) return { missing: [] };
	const found = await onlyActiveProduct(ctx, answers.requestedEventType);
	return typeof found === "string"
		? { missing: [`${label}: ${found}`] }
		: { answers: { ...answers, requestedProductId: found._id }, missing: [] };
}

const DONE = { patch: {}, missing: [] };

const FILLS: { [T in keyof typeof BACKFILLS]: (ctx: QueryCtx, row: Doc<T>) => Promise<Fill<T>> } = {
	companyApplications: async (ctx, row) =>
		row.productId
			? DONE
			: filled(await applicationProduct(ctx, row), (productId) => ({ productId })),
	pendingCompanyApplications: async (ctx, { form }) =>
		form.productId
			? DONE
			: filled(await onlyActiveProduct(ctx, form.eventType), (productId) => ({
					form: { ...form, productId },
				})),
	companyApplicationOffers: async (ctx, row) => {
		if (row.productId) return DONE;
		const application = await ctx.db.get(row.applicationId);
		const found =
			application?.eventType === row.eventType
				? await applicationProduct(ctx, application)
				: await onlyActiveProduct(ctx, row.eventType);
		return filled(found, (productId) => ({ productId }));
	},
	eventPlanning: async (ctx, row) => {
		const agreed =
			row.productId || !row.eventType
				? DONE
				: filled<"eventPlanning">(
						await planningProduct(ctx, row.eventId, row.eventType),
						(productId) => ({ productId }),
					);
		const { answers, missing } = await requested(ctx, row.answers, "requested type");
		return {
			patch: { ...agreed.patch, ...(answers && { answers }) },
			missing: [...agreed.missing, ...missing],
		};
	},
	eventPlanningSubmissions: async (ctx, row) => {
		const answers = await requested(ctx, row.answers, "requested type");
		const draft = await requested(ctx, row.draft, "draft requested type");
		return {
			patch: {
				...(answers.answers && { answers: answers.answers }),
				...(draft.answers && { draft: draft.answers }),
			},
			missing: [...answers.missing, ...draft.missing],
		};
	},
};

export const backfillApplications = migrations.define({
	table: "companyApplications",
	migrateOne: async (ctx, row) => (await FILLS.companyApplications(ctx, row)).patch,
});
export const backfillPendingApplications = migrations.define({
	table: "pendingCompanyApplications",
	migrateOne: async (ctx, row) => (await FILLS.pendingCompanyApplications(ctx, row)).patch,
});
export const backfillOffers = migrations.define({
	table: "companyApplicationOffers",
	migrateOne: async (ctx, row) => (await FILLS.companyApplicationOffers(ctx, row)).patch,
});
export const backfillPlanning = migrations.define({
	table: "eventPlanning",
	migrateOne: async (ctx, row) => (await FILLS.eventPlanning(ctx, row)).patch,
});
export const backfillPlanningSubmissions = migrations.define({
	table: "eventPlanningSubmissions",
	migrateOne: async (ctx, row) => (await FILLS.eventPlanningSubmissions(ctx, row)).patch,
});

const BACKFILLS = {
	companyApplications: "products/references:backfillApplications",
	pendingCompanyApplications: "products/references:backfillPendingApplications",
	companyApplicationOffers: "products/references:backfillOffers",
	eventPlanning: "products/references:backfillPlanning",
	eventPlanningSubmissions: "products/references:backfillPlanningSubmissions",
} as const;

const [first, ...next] = Object.values(BACKFILLS);
export const BACKFILL = { fn: first, next, reset: true };

async function tableReport<T extends keyof typeof BACKFILLS>(
	ctx: QueryCtx,
	table: T,
	limit: number,
) {
	const read = await ctx.db.query(table).take(limit + 1);
	const rows = read.slice(0, limit) as Doc<T>[];
	const missing: { id: Id<T>; reason: string }[] = [];
	for (const row of rows) {
		const fill = await FILLS[table](ctx, row);
		const reasons = Object.keys(fill.patch).length ? ["not filled in yet"] : [];
		missing.push(
			...[...reasons, ...fill.missing].map((reason) => ({ id: row._id as Id<T>, reason })),
		);
	}
	return { rows: rows.length, complete: read.length <= limit, missing };
}

export async function referenceReport(ctx: QueryCtx, limit = REPORT_LIMIT) {
	const counts = await Promise.all(
		EVENT_TYPES.map(async (eventType) => ({
			eventType,
			activeProducts: (await activeProducts(ctx, eventType)).length,
		})),
	);
	return {
		typesWithoutOneActiveProduct: counts.filter(({ activeProducts }) => activeProducts !== 1),
		tables: {
			companyApplications: await tableReport(ctx, "companyApplications", limit),
			pendingCompanyApplications: await tableReport(ctx, "pendingCompanyApplications", limit),
			companyApplicationOffers: await tableReport(ctx, "companyApplicationOffers", limit),
			eventPlanning: await tableReport(ctx, "eventPlanning", limit),
			eventPlanningSubmissions: await tableReport(ctx, "eventPlanningSubmissions", limit),
		},
	};
}

export const report = internalQuery({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => await referenceReport(ctx, limit),
});

export const announce = internalMutation({
	args: {},
	handler: async (ctx) => {
		const { tables, typesWithoutOneActiveProduct } = await referenceReport(ctx);
		const lines = Object.entries(tables).flatMap(([table, { rows, complete, missing }]) => {
			const reasons = new Map<string, number>();
			for (const { reason } of missing) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
			const without = new Set(missing.map(({ id }) => id)).size;
			return [
				`${table}: ${without} av ${rows} mangler produkt${complete ? "" : " (ikke alle rader er lest)"}`,
				...[...reasons].map(([reason, count]) => `${count} × ${reason}`),
			];
		});
		const types = typesWithoutOneActiveProduct
			.map(({ eventType, activeProducts }) => `${eventType} (${activeProducts})`)
			.join(", ");
		await ctx.scheduler.runAfter(0, internal.iam.notifications.sendMessage, {
			channel: SYSTEM_ALERTS_CHANNEL,
			clientMsgId: `product-references-${Date.now()}`,
			text: [
				"*Produktreferanser*",
				...lines,
				...(types ? [`Typer uten nøyaktig ett aktivt produkt: ${types}`] : []),
			].join("\n"),
		});
	},
});
