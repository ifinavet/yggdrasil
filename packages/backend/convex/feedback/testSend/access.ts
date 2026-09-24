import { ConvexError, v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { feedbackEmailContext } from "../delivery/emailContext";

const testSendDomain = "@ifinavet.no";

export const recipient = internalQuery({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		const user = await requireRole(ctx, internalRoles);
		if (!user.email.toLowerCase().endsWith(testSendDomain))
			throw new ConvexError(`Testutsending krever en ${testSendDomain}-adresse.`);
		const event = await ctx.db.get(eventId);
		if (!event) throw new ConvexError("Fant ikke arrangementet.");
		const email = await feedbackEmailContext(ctx, event);
		if (!email) throw new ConvexError("Fant ikke bedriften.");
		return {
			userId: user._id,
			to: user.email,
			email,
			eventStart: event.eventStart,
		};
	},
});
