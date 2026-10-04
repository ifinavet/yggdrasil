import { EVENT_PLANNING, eventPlanningAt } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { ensurePlanning, planningForEvent } from "./helpers";
import { notifyPlanning } from "./notifications";

export async function prepareDue(ctx: MutationCtx, event: Doc<"events">, now: number) {
	if (
		event.externalEvent ||
		event.eventStart <= now ||
		eventPlanningAt(event.eventStart, EVENT_PLANNING.channelDaysBefore) > now
	)
		return;
	const planning = await ensurePlanning(ctx, event);
	if (planning.status === "preparing")
		await notifyPlanning(
			ctx,
			event,
			`ready:${planning._id}`,
			"Mail for førstegangskontakt er klar for gjennomgang. Kontroller kontaktperson i bedriften og forhåndsutfylte opplysninger før du sender.",
		);
}
export const discover = internalMutation({
	args: { cursor: v.optional(v.string()) },
	handler: async (ctx, { cursor }): Promise<void> => {
		const now = Date.now();
		const page = await ctx.db
			.query("events")
			.withIndex("by_eventStart", (q) => q.gt("eventStart", now))
			.paginate({ numItems: 40, cursor: cursor ?? null });
		await Promise.all(page.page.map((event) => prepareDue(ctx, event, now)));
		if (!page.isDone)
			await ctx.scheduler.runAfter(0, internal.events.planning.lifecycle.discover, {
				cursor: page.continueCursor,
			});
	},
});
export async function stalePlanningNotice(
	ctx: QueryCtx,
	eventId: Doc<"events">["_id"],
	key: string,
) {
	if (!key.startsWith("planning:")) return false;
	const planning = await planningForEvent(ctx, eventId);
	if (!planning) return true;
	const parts = key.split(":");
	if (parts[1] === "ready") return planning.status !== "preparing";
	if (parts[1] === "review") {
		const submission = planning.latestSubmissionId
			? await ctx.db.get(planning.latestSubmissionId)
			: null;
		return (
			planning.status !== "invited" ||
			submission?._id !== parts[2] ||
			submission?.status !== "ready"
		);
	}
	if (parts[1] === "publish-error") return !planning.error;
	if (parts[1] === "email-error") {
		const id = ctx.db.normalizeId("eventPlanningEmails", parts[2] ?? "");
		const email = id ? await ctx.db.get(id) : null;
		return (
			!email ||
			email.resolvedAt !== undefined ||
			!email.error ||
			(parts[3] !== undefined && parts[3] !== "send" && parts[3] !== email.status)
		);
	}
	return false;
}
export async function planningFollowup(
	ctx: QueryCtx,
	event: Doc<"events">,
): Promise<number | null> {
	const planning = await planningForEvent(ctx, event._id);
	if (!planning || planning.status === "manual" || planning.status === "closed")
		return planning?.resolvedAt ?? event.eventStart;
	if (planning.error) return null;
	const failure = await ctx.db
		.query("eventPlanningEmails")
		.withIndex("by_planningId", (q) => q.eq("planningId", planning._id))
		.filter((q) =>
			q.and(q.neq(q.field("error"), undefined), q.eq(q.field("resolvedAt"), undefined)),
		)
		.first();
	if (failure) return null;
	const submission = planning.latestSubmissionId
		? await ctx.db.get(planning.latestSubmissionId)
		: null;
	return submission?.status === "ready" ? null : (submission?.decidedAt ?? event.eventStart);
}
