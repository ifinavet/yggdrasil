import { ConvexError, v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { requirePreviewForm } from "./report";

const testSendDomain = "@ifinavet.no";

export const recipient = internalQuery({
	args: { eventId: v.id("events") },
	handler: async (ctx, { eventId }) => {
		const user = await requireRole(ctx, internalRoles);
		if (!user.email.toLowerCase().endsWith(testSendDomain))
			throw new ConvexError(`Testutsending krever en ${testSendDomain}-adresse.`);
		const { event } = await requirePreviewForm(ctx, eventId);
		return { to: user.email, title: event.title, eventStart: event.eventStart };
	},
});
