import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

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
		type: v.optional(v.string()),
	},
	handler: async (ctx, { n, type }) => {
		const query = ctx.db
			.query("jobListings")
			.withIndex("by_deadlineAndPublished", (q) =>
				q.eq("published", true).gte("deadline", Date.now()),
			)
			.order("asc");

		const queryTypeFiltered = type ? query.filter((q) => q.eq(q.field("type"), type)) : query;

		const listings = n ? await queryTypeFiltered.take(n) : await queryTypeFiltered.collect();

		const listingsWithCompany = await addCompanyToListings(ctx, listings);

		return listingsWithCompany;
	},
});

async function addCompanyToListings(ctx: QueryCtx, listings: Doc<"jobListings">[]) {
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
