import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { countRegistrationsWithStatus } from "../events/helper";
import { queueEventNotification } from "../events/slack/state";
import type { RegistrationChange } from "./schema";

export async function logRegistrationChange(
	ctx: MutationCtx,
	registration: Pick<Doc<"registrations">, "eventId" | "userId"> &
		Partial<Pick<Doc<"registrations">, "status">>,
	change: RegistrationChange,
	at = Date.now(),
) {
	if (change === "registered" || change === "accepted") {
		const event = await ctx.db.get(registration.eventId);
		if (
			event?.published &&
			!event.externalEvent &&
			event.participationLimit > 0 &&
			(await countRegistrationsWithStatus(ctx, event._id, "registered")) >= event.participationLimit
		) {
			await queueEventNotification(
				ctx,
				event._id,
				"registration-full",
				"Alle plassene er tatt! 🎉 Arrangementet er nå fullt.",
			);
		}
	}
	await ctx.db.insert("registrationLog", {
		eventId: registration.eventId,
		userId: registration.userId,
		change,
		fromStatus: registration.status,
		at,
	});
}
