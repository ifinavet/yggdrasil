import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Creates a new job listing and its contact records.
 *
 * @param {string} title - The listing title.
 * @param {string} type - The listing type.
 * @param {string} teaser - The listing teaser text.
 * @param {string} description - The full listing description.
 * @param {string} applicationUrl - The application URL.
 * @param {boolean} published - Whether the listing should be publicly visible.
 * @param {Id<"companies">} company - The company id linked to the listing.
 * @param {number} deadline - The application deadline timestamp.
 * @param {{ name: string, email?: string, phone?: string }[]} contacts - The contacts to attach to the listing.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {Id<"jobListings">} - The id of the created job listing.
 */
export const create = mutation({
    args: {
        title: v.string(),
        type: v.string(),
        teaser: v.string(),
        description: v.string(),
        applicationUrl: v.string(),
        published: v.boolean(),
        company: v.id("companies"),
        deadline: v.number(),
        contacts: v.array(
            v.object({
                name: v.string(),
                email: v.optional(v.string()),
                phone: v.optional(v.string()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        const listing = await ctx.db.insert("jobListings", {
            title: args.title,
            type: args.type,
            teaser: args.teaser,
            description: args.description,
            applicationUrl: args.applicationUrl,
            published: args.published,
            company: args.company,
            deadline: args.deadline,
        });

        for (const contact of args.contacts) {
            await ctx.db.insert("jobListingContacts", {
                ...contact,
                listingId: listing,
            });
        }

        return listing;
    },
});

/**
 * Updates a job listing and replaces its contact records.
 *
 * @param {Id<"jobListings">} id - The id of the listing to update.
 * @param {string} title - The updated listing title.
 * @param {string} type - The updated listing type.
 * @param {string} teaser - The updated listing teaser text.
 * @param {string} description - The updated full listing description.
 * @param {string} applicationUrl - The updated application URL.
 * @param {boolean} published - Whether the listing should be publicly visible.
 * @param {Id<"companies">} company - The updated company id.
 * @param {number} deadline - The updated application deadline timestamp.
 * @param {{ name: string, email?: string, phone?: string }[]} contacts - The updated contacts for the listing.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {Id<"jobListings">} - The id of the updated job listing.
 */
export const update = mutation({
    args: {
        id: v.id("jobListings"),
        title: v.string(),
        type: v.string(),
        teaser: v.string(),
        description: v.string(),
        applicationUrl: v.string(),
        published: v.boolean(),
        company: v.id("companies"),
        deadline: v.number(),
        contacts: v.array(
            v.object({
                name: v.string(),
                email: v.optional(v.string()),
                phone: v.optional(v.string()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        const listing = await ctx.db.replace(args.id, {
            title: args.title,
            type: args.type,
            teaser: args.teaser,
            description: args.description,
            applicationUrl: args.applicationUrl,
            published: args.published,
            company: args.company,
            deadline: args.deadline,
        });

        const contacts = await ctx.db
            .query("jobListingContacts")
            .withIndex("by_listingId", (q) => q.eq("listingId", args.id))
            .collect();

        for (const contact of contacts) {
            await ctx.db.delete(contact._id);
        }

        for (const contact of args.contacts) {
            await ctx.db.insert("jobListingContacts", {
                ...contact,
                listingId: args.id,
            });
        }

        return listing;
    },
});

/**
 * Deletes a job listing and all of its contacts.
 *
 * @param {Id<"jobListings">} id - The id of the listing to delete.
 *
 * @throws - An error if the mutation is called without an authenticated user.
 * @returns {Id<"jobListings">} - The id of the deleted job listing.
 */
export const remove = mutation({
    args: {
        id: v.id("jobListings"),
    },
    handler: async (ctx, { id }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            throw new Error("Unauthenticated call to mutation");
        }

        const contacts = await ctx.db
            .query("jobListingContacts")
            .withIndex("by_listingId", (q) => q.eq("listingId", id))
            .collect();

        for (const contact of contacts) {
            await ctx.db.delete(contact._id);
        }

        await ctx.db.delete(id);

        return id;
    },
});
