"use node";
import { render } from "@react-email/render";
import EventPlanningEmail from "@workspace/emails/event-planning-email";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";

export const deliver = internalAction({
	args: { id: v.id("eventPlanningEmails") },
	handler: async (ctx, { id }): Promise<void> => {
		try {
			const email = await ctx.runQuery(internal.events.planning.delivery.getEmail, { id });
			if (email?.status !== "pending") return;
			const html = await render(
				EventPlanningEmail({
					...email.envelope,
					url: email.url,
					confirmation: email.kind === "confirmation",
				}),
			);
			await ctx.runMutation(internal.events.planning.delivery.enqueueRendered, { id, html });
		} catch {
			await ctx.runMutation(internal.events.planning.delivery.recordFailure, {
				id,
				message: "Kunne ikke klargjøre e-posten. Vi prøver igjen automatisk; se status i Bifrost.",
			});
		}
	},
});
