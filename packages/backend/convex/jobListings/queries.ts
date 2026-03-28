import { OrderedQuery } from "convex/server";
import { v } from "convex/values";
import { DataModel, Doc } from "../_generated/dataModel";
import { query, QueryCtx } from "../_generated/server";

export const getAll = query({
    args: {
        n: v.optional(v.number()),
        type: v.optional(v.string()),
    },
    handler: async (ctx, { n, type }) => {
        const query = type
            ? ctx.db
                .query("jobListings")
                .withIndex("by_deadlineAndType", (q) => q.eq("type", type))
                .order("desc")
            : ctx.db.query("jobListings").withIndex("by_deadline").order("desc");

        const listings = n ? await query.take(n) : await query.collect();

        const listingsWithCompany = await addCompanyToListings(ctx, listings);

        return listingsWithCompany;
    },
});

export const getAllPublishedAndActive = query({
    args: {
        n: v.optional(v.number()),
        listingType: v.optional(v.string()),
        sorting: v.optional(v.string()),
        company: v.optional(v.id("companies")),
    },
    handler: async (ctx, { n, listingType, sorting, company }) => {
        let query: OrderedQuery<DataModel["jobListings"]> = ctx.db
            .query("jobListings")
            .withIndex("by_deadlineAndPublished", (q) =>
                q.eq("published", true).gte("deadline", Date.now()),
            )
            .order("asc");

        if (listingType) {
            query = query.filter((q) => q.eq(q.field("type"), listingType));
        }

        if (company) {
            query = query.filter((q) => q.eq(q.field("company"), company));
        }

        const listings = n ? await query.take(n) : await query.collect();

        const listingsWithCompany = await addCompanyToListings(ctx, listings);

        if (sorting) {
            switch (sorting) {
                case "title":
                    return listingsWithCompany.sort((a, b) =>
                        a.title.localeCompare(b.title),
                    );
                case "deadline_desc":
                    return listingsWithCompany.sort((a, b) => b.deadline - a.deadline);
                case "deadline_asc":
                    return listingsWithCompany.sort((a, b) => a.deadline - b.deadline);
            }
        }

        return listingsWithCompany;
    },
});

async function addCompanyToListings(
    ctx: QueryCtx,
    listings: Doc<"jobListings">[],
) {
    const listingsWithCompany = await Promise.all(
        listings.map(async (listing) => {
            const company = await ctx.db.get(listing.company);
            if (!company) {
                throw new Error(`Company with ID ${listing.company} not found`);
            }

            const logo = await ctx.db.get(company?.logo);
            if (!logo) {
                throw new Error(`Company logo with ID ${company.logo} not found`);
            }

            const imageUrl = await ctx.storage.getUrl(logo.image);
            if (!imageUrl) {
                throw new Error(`Image URL for logo with ID ${logo.image} not found`);
            }

            return {
                ...listing,
                companyName: company?.name || "Ukjent bedrift",
                companyLogo: imageUrl,
            };
        }),
    );

    return listingsWithCompany;
}

export const getById = query({
    args: {
        id: v.id("jobListings"),
    },
    handler: async (ctx, { id }) => {
        const listing = await ctx.db.get(id);
        if (!listing) {
            throw new Error("Job listing not found");
        }

        const contacts = await ctx.db
            .query("jobListingContacts")
            .withIndex("by_listingId", (q) => q.eq("listingId", id))
            .collect();

        return {
            ...listing,
            contacts: contacts.map((contact) => ({
                id: contact._id,
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
            })),
        };
    },
});