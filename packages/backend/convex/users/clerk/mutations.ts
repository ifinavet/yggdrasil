import type { UserJSON } from "@clerk/backend";
import { type Validator, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { userByExternalId } from "./queries";

const ANONYMIZED_USER = {
	email: "",
	firstName: "Slettet",
	lastName: "bruker",
	image: "",
	locked: true,
};

const DELETED_EXTERNAL_ID_PREFIX = "deleted:";

/**
 * Creates or updates a user from a Clerk webhook payload.
 *
 * @param {UserJSON} data - The Clerk user payload.
 *
 * @returns {null} - Returns null when the user has been synchronized successfully.
 */
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

/**
 * Creates a user for an external id if none exists yet.
 *
 * @param {string} externalId - The external auth provider id.
 * @param {string} firstName - The user's first name.
 * @param {string} lastName - The user's last name.
 * @param {string} email - The user's email address.
 * @param {string} image - The user's profile image URL.
 *
 * @returns {Id<"users">} - The existing or newly created user id.
 */
export const createIfNotExists = internalMutation({
	args: {
		externalId: v.string(),
		firstName: v.string(),
		lastName: v.string(),
		email: v.string(),
		image: v.string(),
	},
	handler: async (ctx, { externalId, firstName, lastName, email, image }) => {
		const user = await userByExternalId(ctx, externalId);

		if (!user) {
			console.warn(`User for externalId ${externalId} not found, creating...`);
			// Create user
			const id = await ctx.db.insert("users", {
				externalId,
				email,
				firstName,
				lastName,
				image,
				locked: false,
			});

			return id;
		}

		return user._id;
	},
});

async function revokeAccessRights(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const assignedRights = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	await Promise.all(assignedRights.map((right) => ctx.db.delete(right._id)));
}

async function removeInternalPositions(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const positions = await ctx.db
		.query("internals")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	await Promise.all(positions.map((position) => ctx.db.delete(position._id)));
}

async function removeStudentProfiles(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const profiles = await ctx.db
		.query("students")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	for (const profile of profiles) {
		const points = await ctx.db
			.query("points")
			.withIndex("by_studentId", (q) => q.eq("studentId", profile._id))
			.collect();

		await Promise.all(points.map((point) => ctx.db.delete(point._id)));
		await ctx.db.delete(profile._id);
	}
}

/**
 * Anonymizes a user that was deleted in Clerk and removes their personal records.
 *
 * Event history keeps pointing at the anonymized user, so no reader is left with a dangling reference.
 *
 * @param {string} clerkUserId - The Clerk user id that was deleted.
 *
 * @returns {null} - Returns null when the user has been anonymized, or when no user matched.
 */
export const deleteFromClerk = internalMutation({
	args: { clerkUserId: v.string() },
	async handler(ctx, { clerkUserId }) {
		const user = await userByExternalId(ctx, clerkUserId);

		if (user === null) {
			console.warn(`Can't delete user, there is none for Clerk user ID: ${clerkUserId}`);
			return;
		}

		await revokeAccessRights(ctx, user._id);
		await removeInternalPositions(ctx, user._id);
		await removeStudentProfiles(ctx, user._id);

		await ctx.db.patch(user._id, {
			...ANONYMIZED_USER,
			externalId: `${DELETED_EXTERNAL_ID_PREFIX}${clerkUserId}`,
		});
	},
});
