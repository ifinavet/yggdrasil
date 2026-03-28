import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUserOrThrow } from "../auth/currentUser";

/*
 * Fetch all responses for a from.
 */
export const getFormResponsesByFormId = query({
    args: {
        formId: v.id("form"),
    },
    handler: async (ctx, { formId }) => {
        await getCurrentUserOrThrow(ctx);

        return await ctx.db
            .query("formResponses")
            .withIndex("by_formId", (q) => q.eq("formId", formId))
            .collect();
    },
});

/*
 * Get the current user's response for a form.
 */
export const getCurrentUsersResponseByFormId = query({
    args: {
        formId: v.id("form"),
    },
    handler: async (ctx, { formId }) => {
        const user = await getCurrentUserOrThrow(ctx);

        const responses = await ctx.db
            .query("formResponses")
            .withIndex("by_formId", (q) => q.eq("formId", formId))
            .collect();

        const response = responses.find((r) => {
            const data = r.data;
            const userId = data.userId as string | undefined;

            return userId === user.externalId;
        });

        return response;
    },
});

/*
 * Check if the current user can answer the given form
 */
export const checkIfCurrentUserAttendedTheEventAndShouldBeAbleToSubmit = query({
    args: {
        eventId: v.id("events"),
    },
    handler: async (ctx, { eventId }) => {
        const user = await getCurrentUserOrThrow(ctx);

        const event = await ctx.db.get(eventId);

        if (!event) return false;
        console.log(event);

        // Check if the user is an organizer
        const organizers = await ctx.db
            .query("eventOrganizers")
            .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
            .filter((q) => q.eq(q.field("userId"), user._id))
            .first();

        if (organizers) return true;

        // Chek if the user is an attendant
        const attendance = await ctx.db
            .query("registrations")
            .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
            .filter((q) => q.eq(q.field("userId"), user._id))
            .first();

        if (!attendance) return false;
        console.log(attendance);

        if (attendance.attendanceStatus === undefined || attendance.attendanceStatus === "no_show") {
            return false;
        }
        console.log(attendance.attendanceStatus);

        return true;
    },
});