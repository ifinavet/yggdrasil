import { v } from "convex/values";
import { query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { canSubmitEventFeedback } from "./access";

/**
 * Fetches all responses for a form.
 *
 * @param {Id<"form">} formId - The id of the form to fetch responses for.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {Doc<"formResponses">[]} - All stored responses for the given form.
 */
export const getFormResponsesByFormId = query({
	args: {
		formId: v.id("form"),
	},
	handler: async (ctx, { formId }) => {
		await requireRole(ctx, internalRoles);

		const responses = await ctx.db
			.query("formResponses")
			.withIndex("by_formId", (q) => q.eq("formId", formId))
			.collect();

		// The index selects legacy responses, but does not narrow the document union.
		return responses.filter((response) => "formId" in response);
	},
});

/**
 * Fetches the current user's response for a form.
 *
 * @param {Id<"form">} formId - The id of the form to inspect.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {Doc<"formResponses"> | undefined} - The matching response for the current user, if one exists.
 */
export const getCurrentUsersResponseByFormId = query({
	args: {
		formId: v.id("form"),
	},
	handler: async (ctx, { formId }) => {
		const user = await getCurrentUserOrThrow(ctx);

		return await ctx.db
			.query("formResponses")
			.withIndex("by_formId", (q) => q.eq("formId", formId))
			.filter((q) => q.eq(q.field("data.userId"), user.externalId))
			.first();
	},
});

/**
 * Checks whether the current user is allowed to submit the event feedback form.
 *
 * @param {Id<"events">} eventId - The id of the event tied to the form.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {boolean} - Whether the current user attended or organized the event.
 */
export const checkIfCurrentUserAttendedTheEventAndShouldBeAbleToSubmit = query({
	args: {
		eventId: v.id("events"),
	},
	handler: async (ctx, { eventId }) => {
		const user = await getCurrentUserOrThrow(ctx);

		return await canSubmitEventFeedback(ctx, eventId, user._id);
	},
});
