import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";

/**
 * Inserts a response into a form.
 *
 * @param {Id<"form">} formId - The id of the form receiving the response.
 * @param {Record<string, any>} data - The submitted response payload.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the response is stored successfully.
 */
export const submitFormResponse = mutation({
    args: {
        formId: v.id("form"),
        data: v.record(v.string(), v.any()),
    },
    handler: async (ctx, { formId, data }) => {
        await getCurrentUserOrThrow(ctx);

        await ctx.db.insert("formResponses", {
            formId,
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
