import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { authComponent, getCurrentUserOrThrow } from "./auth";
import { accessRoles } from "./schema";

export const getBoardMemberByPosition = query({
	args: {
		position: v.string(),
	},
	handler: async (ctx, { position }) => {
		const member = await ctx.db
			.query("internals")
			.withIndex("by_position", (q) => q.eq("position", position))
			.first();

		if (!member) {
			return null;
		}

		const user = await authComponent.getAnyUserById(ctx, member.userId);
		if (!user) {
			throw new Error(`User not found for board member with ID: ${member._id}`);
		}

		return {
			...member,
			...user,
		};
	},
});

export const getTheBoard = query({
	handler: async (ctx) => {
		const members = await ctx.db
			.query("internals")
			.filter((q) => q.neq(q.field("position"), "Intern"))
			.collect();

		const boardMembers = await Promise.all(
			members.map(async (member) => {
				const user = await authComponent.getAnyUserById(ctx, member.userId);
				return {
					...member,
					fullName: (user && `${user.name}`) ?? "Styremedlem",
					email: user?.email ?? "styret@ifinavet.no",
					image: user?.image,
				};
			}),
		);

		// Sort board members by rank, if defined
		boardMembers.sort((a, b) => {
			if (a.rank !== undefined && b.rank !== undefined) {
				return a.rank - b.rank;
			}

			if (a.rank !== undefined && b.rank === undefined) {
				return -1;
			}

			if (a.rank === undefined && b.rank !== undefined) {
				return 1;
			}

			return 0;
		});

		return boardMembers;
	},
});

export const getById = query({
	args: {
		id: v.id("internals"),
	},
	handler: async (ctx, { id }) => {
		const internal = await ctx.db.get(id);
		if (!internal) {
			throw new Error(`Internal record not found for ID: ${id}`);
		}

		const user = await authComponent.getAnyUserById(ctx, internal.userId);
		if (!user) {
			throw new Error(`User not found for internal record with ID: ${id}`);
		}

		const rights = await ctx.db
			.query("accessRights")
			.withIndex("by_userId", (q) => q.eq("userId", internal.userId))
			.first();

		return {
			...internal,
			fullName: `${user.name}`,
			email: user.email,
			image: user.image,
			accessRights: rights?.role,
		};
	},
});

export const upsertBoardMember = mutation({
	args: {
		id: v.id("internals"),
		userId: v.id("users"),
		position: v.string(),
		group: v.string(),
		positionEmail: v.optional(v.string()),
		role: accessRoles,
	},
	handler: async (
		ctx,
		{ id, userId, position, group, positionEmail, role },
	) => {
		const currentBoardMember = await ctx.db.get(id);
		if (!currentBoardMember)
			throw new Error(`Board member not found for ID: ${id}`);

		await ctx.runMutation(api.accsessRights.upsertAccessRights, {
			userId,
			role,
		});

		if (currentBoardMember.userId !== userId) {
			await ctx.db.patch(id, {
				group: "",
				positionEmail: "",
				position: "Intern",
			});

			const newBoardMember = await ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", userId))
				.first();
			if (!newBoardMember)
				throw new Error(`New board member not found for user ID: ${userId}`);

			await ctx.db.patch(newBoardMember._id, {
				group,
				positionEmail,
				position,
			});
		} else {
			await ctx.db.patch(id, {
				position,
				group,
				positionEmail,
			});
		}
	},
});

export const getAll = query({
	handler: async (ctx) => {
		const internals = await ctx.db.query("internals").collect();

		return await Promise.all(
			internals.map(async (internal) => {
				const user = await authComponent.getAnyUserById(ctx, internal.userId);
				if (!user)
					return {
						...internal,
						fullName: "Ukjent, Error",
					};

				return {
					...internal,
					fullName: `${user.name}`,
				};
			}),
		);
	},
});

export const getAllInternals = query({
	handler: async (ctx) => {
		const internals = await ctx.db
			.query("internals")
			.withIndex("by_position", (q) => q.eq("position", "Intern"))
			.collect();

		return await Promise.all(
			internals.map(async (internal) => {
				const user = await authComponent.getAnyUserById(ctx, internal.userId);

				const rights = await ctx.db
					.query("accessRights")
					.withIndex("by_userId", (q) => q.eq("userId", internal.userId))
					.first();

				if (!user)
					return {
						...internal,
						fullName: "Ukjent, Error",
						email: "Ukjent, Error",
						image: null,
						role: rights?.role,
					};

				return {
					...internal,
					fullName: `${user.name}`,
					email: user.email,
					image: user.image,
					role: rights?.role,
				};
			}),
		);
	},
});

export const createInternal = mutation({
	args: {
		userId: v.id("users"),
		group: v.string(),
	},
	handler: async (ctx, { userId, group }) => {
		await getCurrentUserOrThrow(ctx);

		const existingInternal = await ctx.db
			.query("internals")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		if (existingInternal) {
			throw new Error(`Internal member already exists for user ID: ${userId}`);
		}

		await ctx.db.insert("internals", {
			userId,
			group,
			position: "Intern",
		});

		await ctx.runMutation(api.accsessRights.upsertAccessRights, {
			userId,
			role: "internal",
		});
	},
});

export const removeInternal = mutation({
	args: {
		id: v.id("internals"),
	},
	handler: async (ctx, { id }) => {
		await getCurrentUserOrThrow(ctx);

		await ctx.db.delete(id);
	},
});

export const updateInternal = mutation({
	args: {
		id: v.id("internals"),
		group: v.string(),
	},
	handler: async (ctx, { id, group }) => {
		await getCurrentUserOrThrow(ctx);

		await ctx.db.patch(id, { group });
	},
});
