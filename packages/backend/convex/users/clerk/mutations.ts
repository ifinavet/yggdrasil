import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { userByExternalId } from "./queries";

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
            console.warn(
                `User for externalId ${externalId} not found, creating... \n { firstName: ${firstName}, lastName: ${lastName}, email: ${email}, image: ${image}}`,
            );
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

/**
 * Deletes a user that originated from Clerk.
 *
 * @param {string} clerkUserId - The Clerk user id to remove.
 *
 * @returns {null} - Returns null when the delete attempt has completed.
 */
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
