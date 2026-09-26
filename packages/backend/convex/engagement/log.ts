import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { RegistrationChange } from "./schema";

export async function logRegistrationChange(
	ctx: MutationCtx,
	registration: Pick<Doc<"registrations">, "eventId" | "userId"> &
		Partial<Pick<Doc<"registrations">, "status">>,
	change: RegistrationChange,
	at = Date.now(),
) {
	await ctx.db.insert("registrationLog", {
		eventId: registration.eventId,
		userId: registration.userId,
		change,
		fromStatus: registration.status,
		at,
	});
}
