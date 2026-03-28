import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { userByExternalId } from "./queries";

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
