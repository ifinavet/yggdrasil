import type { OrderedQuery } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
	internalAction,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

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

		// Send Slack notification if listing is published
		if (args.published) {
			await ctx.scheduler.runAfter(
				0,
				internal.listings.notifySlackJobListingPublished,
				{
					listingId: listing,
				},
			);
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

		// Get existing listing to check if it was previously unpublished
		const existingListing = await ctx.db.get(args.id);
		const wasUnpublished = existingListing && !existingListing.published;

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

		// Send Slack notification if listing is newly published
		if (args.published && wasUnpublished) {
			await ctx.scheduler.runAfter(
				0,
				internal.listings.notifySlackJobListingPublished,
				{
					listingId: args.id,
				},
			);
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

// Internal action to send Slack notification when job listing is published
export const notifySlackJobListingPublished = internalAction({
	args: {
		listingId: v.id("jobListings"),
	},
	handler: async (ctx, { listingId }) => {
		const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

		if (!slackWebhookUrl) {
			console.log("SLACK_WEBHOOK_URL not configured, skipping notification");
			return;
		}

		// Get the listing data
		const listing = await ctx.runQuery(internal.listings.getById, {
			id: listingId,
		});

		if (!listing) {
			console.error(`Job listing with ID ${listingId} not found`);
			return;
		}

		// Get company info
		const company = await ctx.runQuery(internal.companies.getById, {
			id: listing.company,
		});

		// Send to Slack
		try {
			const response = await fetch(slackWebhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: `🆕 New Job Listing: ${listing.title}`,
					blocks: [
						{
							type: "header",
							text: {
								type: "plain_text",
								text: `🆕 ${listing.title}`,
							},
						},
						{
							type: "section",
							fields: [
								{
									type: "mrkdwn",
									text: `*Company:*\n${company?.name || "Unknown"}`,
								},
								{
									type: "mrkdwn",
									text: `*Type:*\n${listing.type}`,
								},
								{
									type: "mrkdwn",
									text: `*Deadline:*\n${new Date(listing.deadline).toLocaleDateString()}`,
								},
							],
						},
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: listing.teaser,
							},
						},
						{
							type: "actions",
							elements: [
								{
									type: "button",
									text: {
										type: "plain_text",
										text: "Apply Now",
									},
									url: listing.applicationUrl,
									style: "primary",
								},
							],
						},
					],
				}),
			});

			if (!response.ok) {
				console.error(
					`Failed to send Slack notification: ${response.status} ${response.statusText}`,
				);
			} else {
				console.log("Job listing notification sent to Slack:", {
					id: listingId,
					title: listing.title,
				});
			}
		} catch (error) {
			console.error("Error sending Slack notification:", error);
		}
	},
});
