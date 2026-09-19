import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

const QUEUE_HEADROOM_FOR_DELETED_USERS = 25;

export async function countWithStatus(
	ctx: MutationCtx,
	eventId: Id<"events">,
	status: Doc<"registrations">["status"],
) {
	const rows = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
			q.eq("eventId", eventId).eq("status", status),
		)
		.collect();

	return rows.length;
}

export async function offerFreeSeats(ctx: MutationCtx, event: Doc<"events">): Promise<number> {
	const occupied =
		(await countWithStatus(ctx, event._id, "registered")) +
		(await countWithStatus(ctx, event._id, "pending"));
	const free = event.participationLimit - occupied;
	if (free <= 0) return 0;

	const queue = await ctx.db
		.query("registrations")
		.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
			q.eq("eventId", event._id).eq("status", "waitlist"),
		)
		.order("asc")
		.take(free + QUEUE_HEADROOM_FOR_DELETED_USERS);

	let offered = 0;
	for (const waiting of queue) {
		if (offered === free) break;

		const candidate = await ctx.db.get(waiting.userId);
		if (!candidate) {
			await ctx.db.delete(waiting._id);
			continue;
		}

		await ctx.db.patch(waiting._id, { status: "pending", registrationTime: Date.now() });
		await ctx.scheduler.runAfter(0, internal.emails.sendAvailableSeatEmail, {
			participantEmail: candidate.email,
			eventTitle: event.title,
			eventId: event._id,
			registrationId: waiting._id,
		});

		offered += 1;
	}

	return offered;
}
