import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

export const submitFormResponse = mutation({
	args: {
		formId: v.id("form"),
		data: v.record(v.string(), v.any()),
	},
	handler: async (ctx, { formId, data }) => {
		ctx.db.insert("formResponses", {
			formId,
			data,
		});
	},
});

export const getFormResponsesByFormId = query({
	args: {
		formId: v.id("form"),
	},
	handler: async (ctx, { formId }) => {
		return ctx.db
			.query("formResponses")
			.withIndex("by_formId", (q) => q.eq("formId", formId))
			.collect();
	},
});

export const createEventFeedbackForm = internalMutation({
	handler: async (ctx) => {
		return await ctx.db.insert("form", {
			formType: "event-feedback",
		});
	},
});

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
