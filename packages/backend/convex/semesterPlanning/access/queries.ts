import { BOARD_GROUP } from "@workspace/shared/organization";
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { type QueryCtx, query } from "../../_generated/server";
import { internalRoles, userHasRole } from "../../auth/accessRights";
import { currentSemesterPlanRights, requireSemesterPlanner } from "./helper";

const MAX_INTERNALS = 1000;
const MAX_GRANTS = 200;

const memberValidator = v.object({ userId: v.id("users"), name: v.string() });

async function nameOf(ctx: QueryCtx, userId: Id<"users">) {
	const user = await ctx.db.get(userId);
	return user ? `${user.firstName} ${user.lastName}`.trim() : "Ukjent bruker";
}

async function isActiveInternal(ctx: QueryCtx, row: Doc<"internals">) {
	return await userHasRole(ctx, row.userId, internalRoles);
}

export const myRights = query({
	args: {},
	returns: v.object({ canPlan: v.boolean(), canManageAccess: v.boolean() }),
	handler: async (ctx) => await currentSemesterPlanRights(ctx),
});

export const list = query({
	args: {},
	returns: v.object({
		canManageAccess: v.boolean(),
		board: v.array(memberValidator),
		granted: v.array(
			v.object({
				grantId: v.id("semesterPlanAccess"),
				userId: v.id("users"),
				name: v.string(),
				grantedBy: v.string(),
				grantedAt: v.number(),
				active: v.boolean(),
			}),
		),
		candidates: v.array(memberValidator),
	}),
	handler: async (ctx) => {
		await requireSemesterPlanner(ctx);
		const { canManageAccess } = await currentSemesterPlanRights(ctx);

		const internals = await ctx.db.query("internals").take(MAX_INTERNALS);
		const activeRows = (
			await Promise.all(
				internals.map(async (row) => ((await isActiveInternal(ctx, row)) ? row : null)),
			)
		).filter((row) => row !== null);
		const activeUserIds = new Set(activeRows.map((row) => row.userId));

		const boardRows = activeRows.filter((row) => row.group === BOARD_GROUP);
		const board = await Promise.all(
			boardRows.map(async (row) => ({ userId: row.userId, name: await nameOf(ctx, row.userId) })),
		);

		const grants = await ctx.db.query("semesterPlanAccess").take(MAX_GRANTS);
		const granted = await Promise.all(
			grants.map(async (grant) => ({
				grantId: grant._id,
				userId: grant.userId,
				name: await nameOf(ctx, grant.userId),
				grantedBy: await nameOf(ctx, grant.grantedBy),
				grantedAt: grant._creationTime,
				active: activeUserIds.has(grant.userId),
			})),
		);

		const taken = new Set([...boardRows.map((row) => row.userId), ...grants.map((g) => g.userId)]);
		const candidates = canManageAccess
			? await Promise.all(
					activeRows
						.filter((row) => !taken.has(row.userId))
						.map(async (row) => ({ userId: row.userId, name: await nameOf(ctx, row.userId) })),
				)
			: [];

		const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "nb");
		return {
			canManageAccess,
			board: board.sort(byName),
			granted: granted.sort(byName),
			candidates: candidates.sort(byName),
		};
	},
});
