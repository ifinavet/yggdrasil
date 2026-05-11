import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function getEventByIdentifier(ctx: QueryCtx, identifier: string): Promise<Doc<"events">> {
	let event: Doc<"events"> | null = null;

	try {
		event = await ctx.db.get(identifier as Id<"events">);
	} catch {}

	if (!event) {
		event = await ctx.db
			.query("events")
			.withIndex("by_slug", (q) => q.eq("slug", identifier))
			.first();
	}

	if (!event) {
		throw new Error("Event not found");
	}

	return event;
}