import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";

/*
 * Insert a response into the form.
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

/*
 * Create the feedback form.
 */
export const createEventFeedbackForm = internalMutation({
    handler: async (ctx) => {
        return await ctx.db.insert("form", {
            formType: "event-feedback",
        });
    },
});
