import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { countRegistrationsWithStatus } from "../events/helper";
import { registrationFullText } from "../events/slack/messages";
import { queueEventNotification } from "../events/slack/state";
import type { RegistrationChange } from "./schema";
import { refreshEventStats } from "./stats";

export type TouchedEvents = Set<Id<"events">>;

export async function refreshTouched(ctx: MutationCtx, touched: TouchedEvents) {
	for (const eventId of touched) await refreshEventStats(ctx, eventId);
}

export async function logRegistrationChange(
	ctx: MutationCtx,
	registration: Pick<Doc<"registrations">, "eventId" | "userId"> &
		Partial<Pick<Doc<"registrations">, "status">>,
	change: RegistrationChange,
	at = Date.now(),
	touched?: TouchedEvents,
) {
	if (change === "registered" || change === "accepted") {
		const event = await ctx.db.get(registration.eventId);
		if (
			event?.published &&
			!event.externalEvent &&
			event.participationLimit > 0 &&
			(await countRegistrationsWithStatus(ctx, event._id, "registered")) >= event.participationLimit
		) {
			await queueEventNotification(ctx, event._id, "registration-full", registrationFullText);
		}
	}
	await ctx.db.insert("registrationLog", {
		eventId: registration.eventId,
		userId: registration.userId,
		change,
		fromStatus: registration.status,
		at,
	});
	if (touched) touched.add(registration.eventId);
	else await refreshEventStats(ctx, registration.eventId);
}
