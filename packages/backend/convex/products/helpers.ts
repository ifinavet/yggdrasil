import { productInputSchema, type ValidProductInput } from "@workspace/shared/products";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ProductFieldChange } from "./schema";

export const MAX_PRODUCTS = 100;

const TRACKED_FIELDS = [
	"name",
	"shortDescription",
	"longDescription",
	"category",
	"unitPriceOre",
	"vatRate",
	"volumeTiers",
	"startupPriceOre",
	"maxStudents",
	"sortOrder",
	"active",
] as const satisfies readonly (keyof Doc<"products">)[];

type TrackedProduct = Partial<Pick<Doc<"products">, (typeof TRACKED_FIELDS)[number]>>;

function serialize(value: unknown): string | undefined {
	return value === undefined ? undefined : JSON.stringify(value);
}

export function diffProduct(before: TrackedProduct, after: TrackedProduct): ProductFieldChange[] {
	return TRACKED_FIELDS.flatMap((field) => {
		const previous = serialize(before[field]);
		const next = serialize(after[field]);
		return previous === next ? [] : [{ field, before: previous, after: next }];
	});
}

export function parseProductInput(input: unknown): ValidProductInput {
	const result = productInputSchema.safeParse(input);
	if (!result.success) {
		throw new ConvexError(result.error.issues.map((issue) => issue.message).join("\n"));
	}
	return result.data;
}

export async function getProductOrThrow(
	ctx: QueryCtx | MutationCtx,
	productId: Id<"products">,
): Promise<Doc<"products">> {
	const product = await ctx.db.get(productId);
	if (!product) throw new ConvexError("Fant ikke produktet.");
	return product;
}

export async function requireUniqueName(
	ctx: MutationCtx,
	name: string,
	ownId?: Id<"products">,
): Promise<void> {
	const existing = await ctx.db
		.query("products")
		.withIndex("by_name", (q) => q.eq("name", name))
		.first();
	if (existing && existing._id !== ownId) {
		throw new ConvexError("Det finnes allerede et produkt med dette navnet.");
	}
}

export async function nextSortOrder(ctx: MutationCtx): Promise<number> {
	const last = await ctx.db.query("products").withIndex("by_sortOrder").order("desc").first();
	return last ? last.sortOrder + 1 : 0;
}

export async function recordChange(
	ctx: MutationCtx,
	change: Omit<Doc<"productChanges">, "_id" | "_creationTime">,
): Promise<void> {
	if (change.changes.length === 0) return;
	await ctx.db.insert("productChanges", change);
}
