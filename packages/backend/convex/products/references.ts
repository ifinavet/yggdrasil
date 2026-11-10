import { EVENT_TYPES, type EventType } from "@workspace/shared/semester/labels";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { oneOf } from "../lib/validators";
import { migrations } from "../migrations";

type Found = Doc<"products"> | string;
type Answers = Doc<"eventPlanning">["answers"];
type Fill<T extends TableNames> = { patch: Partial<Doc<T>>; missing: string[] };

const REPORT_PAGE = 200;

async function activeProducts(ctx: QueryCtx, eventType: EventType) {
	return await ctx.db
		.query("products")
		.withIndex("by_eventType_and_active", (q) => q.eq("eventType", eventType).eq("active", true))
		.take(2);
}

export async function onlyActiveProduct(ctx: QueryCtx, eventType: EventType): Promise<Found> {
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

export function known(found: Found) {
	return typeof found === "string" ? undefined : found;
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

const FILLS: { [T in (typeof TABLES)[number]]: (ctx: QueryCtx, row: Doc<T>) => Promise<Fill<T>> } =
	{
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

const TABLES = [
	"companyApplications",
	"pendingCompanyApplications",
	"companyApplicationOffers",
	"eventPlanning",
	"eventPlanningSubmissions",
] as const;

const BACKFILL = {
	fn: "products/references:backfillApplications",
	next: [
		"products/references:backfillPendingApplications",
		"products/references:backfillOffers",
		"products/references:backfillPlanning",
		"products/references:backfillPlanningSubmissions",
	],
	reset: true,
};

export const backfill = mutation({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		await ctx.runMutation(internal.migrations.run, BACKFILL);
	},
});

export const report = query({
	args: {
		table: oneOf(TABLES),
		cursor: v.union(v.string(), v.null()),
		numItems: v.optional(v.number()),
	},
	handler: async (ctx, { table, cursor, numItems = REPORT_PAGE }) => {
		await requireRole(ctx, adminRoles);
		const { page, isDone, continueCursor } = await ctx.db
			.query(table)
			.paginate({ cursor, numItems });
		const missing: { id: string; reason: string }[] = [];
		for (const row of page) {
			const fill = await (FILLS[table] as (ctx: QueryCtx, row: unknown) => Promise<Fill<never>>)(
				ctx,
				row,
			);
			const reasons = Object.keys(fill.patch).length ? ["not filled in yet"] : [];
			missing.push(...[...reasons, ...fill.missing].map((reason) => ({ id: row._id, reason })));
		}
		return { rows: page.length, missing, isDone, continueCursor };
	},
});

export const typesWithoutOneActiveProduct = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		const counts = await Promise.all(
			EVENT_TYPES.map(async (eventType) => ({
				eventType,
				activeProducts: (await activeProducts(ctx, eventType)).length,
			})),
		);
		return counts.filter(({ activeProducts }) => activeProducts !== 1);
	},
});
