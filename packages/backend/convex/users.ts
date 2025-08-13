import type { UserJSON } from "@clerk/backend";
import { type Validator, v } from "convex/values";
import { internalMutation, type QueryCtx, query } from "./_generated/server";

export const current = query({
	args: {},
	handler: async (ctx) => {
		return await getCurrentUser(ctx);
	},
});

export const upsertFromClerk = internalMutation({
	args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
	async handler(ctx, { data }) {
		const email = data.email_addresses.find(
			(emailAddress) => emailAddress.id === data.primary_email_address_id,
		)?.email_address;
		const userAttributes = {
			email: email ?? data.email_addresses[0]?.email_address ?? "",
			firstName: data.first_name ?? "",
			lastName: data.last_name ?? "",
			image: data.image_url ?? "",
			externalId: data.id,
			locked: data.locked,
		};

		const user = await userByExternalId(ctx, data.id);
		if (user === null) {
			await ctx.db.insert("users", userAttributes);
		} else {
			await ctx.db.patch(user._id, userAttributes);
		}
	},
});

export const deleteFromClerk = internalMutation({
	args: { clerkUserId: v.string() },
	async handler(ctx, { clerkUserId }) {
		const user = await userByExternalId(ctx, clerkUserId);

		if (user !== null) {
			await ctx.db.delete(user._id);
		} else {
			console.warn(`Can't delete user, there is none for Clerk user ID: ${clerkUserId}`);
		}
	},
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
	const userRecord = await getCurrentUser(ctx);
	if (!userRecord) throw new Error("Can't get current user");
	return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		return null;
	}
	return await userByExternalId(ctx, identity.subject);
}

export async function userByExternalId(ctx: QueryCtx, externalId: string) {
	return await ctx.db
		.query("users")
		.withIndex("by_ExternalId", (q) => q.eq("externalId", externalId))
		.unique();
}
