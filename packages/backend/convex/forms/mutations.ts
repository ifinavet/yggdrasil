import { feedbackErrors } from "@workspace/shared/feedback";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { defaultFeedbackFields } from "../feedback/defaultFields";
import { canSubmitEventFeedback } from "./access";
import { findUserResponse } from "./responses";

/** Stores feedback once per eligible user, preserving the legacy response shape. */
export const submitFormResponse = mutation({
	args: {
		formId: v.id("form"),
		data: v.record(v.string(), v.any()),
	},
	handler: async (ctx, { formId, data }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const form = await ctx.db.get(formId);
		if (!form) throw new ConvexError("Skjemaet finnes ikke.");

		if (form.formType === "event-feedback") {
			const events = await ctx.db
				.query("events")
				.withIndex("by_formId", (q) => q.eq("formId", formId))
				.take(2);
			const event = events[0];
			if (!event || events.length > 1)
				throw new ConvexError("Skjemaet må tilhøre ett arrangement.");
			if (!(await canSubmitEventFeedback(ctx, event._id, user._id))) {
				throw new ConvexError("Du kan ikke svare på dette skjemaet.");
			}
			const { userId, eventId, ...answers } = data;
			if (
				(userId !== undefined && userId !== user.externalId) ||
				(eventId !== undefined && eventId !== event._id)
			) {
				throw new ConvexError("Svaret tilhører ikke denne brukeren og dette arrangementet.");
			}
			const errors = feedbackErrors(defaultFeedbackFields, answers);
			if (Object.keys(errors).length > 0) throw new ConvexError("Svaret inneholder ugyldige felt.");
			const previous = await findUserResponse(ctx, formId, user.externalId);
			if (previous) throw new ConvexError("Du har allerede svart på dette skjemaet.");
			data = { ...answers, userId: user.externalId, eventId: event._id };
		}

		await ctx.db.insert("formResponses", {
			formId,
			userId: typeof data.userId === "string" ? data.userId : undefined,
			data,
		});
	},
});

/**
 * Creates the default event feedback form.
 *
 * @returns {Id<"form">} - The id of the created feedback form document.
 */
export const createEventFeedbackForm = internalMutation({
	handler: async (ctx) => {
		return await ctx.db.insert("form", {
			formType: "event-feedback",
		});
	},
});
