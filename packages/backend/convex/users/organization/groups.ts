import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutation, query } from "../../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../../auth/accessRights";

export const MAX_INTERNAL_GROUPS = 100;

function groupName(value: string) {
	const name = value.trim();
	if (!name || name.length > 100) throw new ConvexError("Skriv et gyldig gruppenavn.");
	return name;
}

function groupDescription(value: string) {
	const description = value.trim();
	if (description.length > 2000) throw new ConvexError("Beskrivelsen er for lang.");
	return description;
}

async function requireUniqueName(ctx: MutationCtx, name: string, except?: Id<"internalGroups">) {
	const existing = await ctx.db
		.query("internalGroups")
		.withIndex("by_name", (q) => q.eq("name", name))
		.take(2);
	if (existing.some((group) => group._id !== except))
		throw new ConvexError("Gruppenavnet er allerede i bruk.");
}

async function hasReferences(ctx: QueryCtx | MutationCtx, group: Doc<"internalGroups">) {
	const [members, applications, reviewedApplications] = await Promise.all([
		ctx.db
			.query("internals")
			.withIndex("by_group", (q) => q.eq("group", group.name))
			.take(1),
		ctx.db
			.query("admissionApplications")
			.withIndex("by_group", (q) => q.eq("group", group._id))
			.take(1),
		ctx.db
			.query("admissionApplications")
			.withIndex("by_reviewedGroupId", (q) => q.eq("reviewedGroupId", group._id))
			.take(1),
	]);
	return Boolean(members.length || applications.length || reviewedApplications.length);
}

export const list = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, adminRoles);
		return await ctx.db.query("internalGroups").withIndex("by_name").take(MAX_INTERNAL_GROUPS);
	},
});

export const save = mutation({
	args: {
		groupId: v.optional(v.id("internalGroups")),
		name: v.string(),
		description: v.string(),
		leader: v.optional(v.union(v.id("users"), v.null())),
	},
	handler: async (ctx, args) => {
		await requireRole(ctx, adminRoles);
		const group = args.groupId ? await ctx.db.get(args.groupId) : null;
		if (args.groupId && !group) throw new ConvexError("Fant ikke arbeidsgruppen.");
		const name = groupName(args.name);
		const description = groupDescription(args.description);
		await requireUniqueName(ctx, name, group?._id);
		if (group) {
			if (name !== group.name && (await hasReferences(ctx, group)))
				throw new ConvexError(
					"Gruppenavnet kan ikke endres mens medlemmer eller søkere bruker gruppen.",
				);
		} else {
			const count = await ctx.db
				.query("internalGroups")
				.withIndex("by_name")
				.take(MAX_INTERNAL_GROUPS);
			if (count.length >= MAX_INTERNAL_GROUPS)
				throw new ConvexError("Maksimalt antall arbeidsgrupper er nådd.");
		}
		if (args.leader && !(await userHasRole(ctx, args.leader, internalRoles)))
			throw new ConvexError("Gruppelederen må være et aktivt internt medlem.");
		const fields = {
			name,
			description,
			leader: args.leader === undefined ? group?.leader : (args.leader ?? undefined),
		};
		if (!group) return ctx.db.insert("internalGroups", fields);
		await ctx.db.patch(group._id, fields);
		return group._id;
	},
});

export const remove = mutation({
	args: { groupId: v.id("internalGroups") },
	handler: async (ctx, { groupId }) => {
		await requireRole(ctx, adminRoles);
		const group = await ctx.db.get(groupId);
		if (!group) return;
		if (group.leader || (await hasReferences(ctx, group)))
			throw new ConvexError("Flytt medlemmer og søkere til en annen gruppe før du sletter den.");
		await ctx.db.delete(groupId);
	},
});
