import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

export const getAllPaged = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, { paginationOpts }) => {
		const companies = await ctx.db.query("companies").paginate(paginationOpts);
		return companies;
	},
});

export const getAll = query({
	handler: async (ctx) => {
		const companies = await ctx.db.query("companies").collect();
		return companies;
	},
});

export const getMainSponsor = query({
	handler: async (ctx) => {
		const mainSponsor = await ctx.db
			.query("companies")
			.filter((q) => q.eq(q.field("mainSponsor"), true))
			.first();

		if (!mainSponsor) return null;

		const companyImage = await ctx.db.get(mainSponsor.logo);
		if (!companyImage) {
			throw new Error(`Company logo with ID ${mainSponsor.logo} not found`);
		}

		const imageUrl = await ctx.storage.getUrl(companyImage.image);
		if (!imageUrl) {
			throw new Error(`Image URL for logo with ID ${companyImage.image} not found`);
		}

		return { ...mainSponsor, imageUrl };
	},
});

export const getById = query({
	args: {
		id: v.id("companies"),
	},
	handler: async (ctx, { id }) => {
		const company = await ctx.db.get(id);
		if (!company) {
			throw new Error(`Company with ID ${id} not found`);
		}

		const companyImage = await ctx.db.get(company.logo);
		if (!companyImage) {
			throw new Error(`Company logo with ID ${company.logo} not found`);
		}

		const imageUrl = await ctx.storage.getUrl(companyImage.image);
		if (!imageUrl) {
			throw new Error(`Image URL for logo with ID ${companyImage.image} not found`);
		}

		return { ...company, imageUrl };
	},
});

export const searchByName = query({
	args: {
		searchQuery: v.string(),
	},
	handler: async (ctx, { searchQuery }) => {
		return await ctx.db
			.query("companies")
			.withSearchIndex("search_name", (q) => q.search("name", searchQuery))
			.take(10);
	},
});

export const getCompanyLogosPaged = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, { paginationOpts }) => {
		const logos = await ctx.db.query("companyLogos").paginate(paginationOpts);

		const logosWithImages = await Promise.all(
			logos.page.map(async (logo) => {
				const imageUrl = await ctx.storage.getUrl(logo.image);
				if (!imageUrl) {
					throw new Error(`Image URL for logo with ID ${logo.image} not found`);
				}

				return {
					...logo,
					imageUrl,
				};
			}),
		);

		return {
			...logos,
			page: logosWithImages,
		};
	},
});

export const getCompanyLogoById = query({
	args: {
		id: v.optional(v.id("companyLogos")),
	},
	handler: async (ctx, { id }) => {
		if (!id) {
			return null;
		}

		const logo = await ctx.db.get(id);
		if (!logo) {
			throw new Error(`Company logo with ID ${id} not found`);
		}

		const imageUrl = await ctx.storage.getUrl(logo.image);
		if (!imageUrl) {
			throw new Error(`Image URL for logo with ID ${logo.image} not found`);
		}

		return { ...logo, imageUrl };
	},
});

export const generateUploadUrl = mutation({
	handler: async (ctx) => {
		await getCurrentUserOrThrow(ctx);

		const uploadUrl = await ctx.storage.generateUploadUrl();

		return uploadUrl;
	},
});

export const uploadCompanyLogo = mutation({
	args: {
		id: v.id("_storage"),
		name: v.string(),
	},
	handler: async (ctx, { id, name }) => {
		await getCurrentUserOrThrow(ctx);

		const logoId = await ctx.db.insert("companyLogos", {
			name,
			image: id,
		});

		return logoId;
	},
});

export const create = mutation({
	args: {
		orgNumber: v.number(),
		name: v.string(),
		description: v.string(),
		logo: v.id("companyLogos"),
	},
	handler: async (ctx, { orgNumber, name, description, logo }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated call to mutation");
		}

		await ctx.db.insert("companies", {
			orgNumber,
			name,
			description,
			logo,
			mainSponsor: false,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("companies"),
		orgNumber: v.number(),
		name: v.string(),
		description: v.string(),
		logo: v.id("companyLogos"),
	},
	handler: async (ctx, { id, orgNumber, name, description, logo }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated call to mutation");
		}

		await ctx.db.patch(id, {
			orgNumber,
			name,
			description,
			logo,
		});
	},
});

export const updateMainSponsor = mutation({
	args: {
		companyId: v.id("companies"),
	},
	handler: async (ctx, { companyId: id }) => {
		await getCurrentUserOrThrow(ctx);

		// Unset previous main sponsor
		const previousMainSponsor = await ctx.db
			.query("companies")
			.filter((q) => q.eq(q.field("mainSponsor"), true))
			.first();

		if (previousMainSponsor) {
			await ctx.db.patch(previousMainSponsor._id, { mainSponsor: false });
		}

		// Set new main sponsor
		await ctx.db.patch(id, { mainSponsor: true });
	},
});

export const remove = mutation({
	args: {
		id: v.id("companies"),
	},
	handler: async (ctx, { id }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated call to mutation");
		}

		await ctx.db.delete(id);
	},
});
