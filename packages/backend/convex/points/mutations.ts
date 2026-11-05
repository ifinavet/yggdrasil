import { DAY_MS } from "@workspace/shared/time";
import type { WithoutSystemFields } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { POINT_LIFETIME_MS } from "./lifetime";
import { hasTooManyPoints } from "./queries";

export async function givePoints(ctx: MutationCtx, point: WithoutSystemFields<Doc<"points">>) {
	const pointId = await ctx.db.insert("points", point);

	await ctx.scheduler.runAfter(DAY_MS, internal.points.mutations.sendPointEmails, { pointId });
}

export function pointWasEmailed(point: Doc<"points">) {
	return point._creationTime + DAY_MS <= Date.now();
}

/**
 * Lets admins and internal members give a student points from bifrost, then calls givePoints.
 * Attendance and late unregistering call givePoints directly, because organizers and students
 * lack these roles. givePoints is a plain function, so clients cannot call it to skip this check.
 *
 * @param {Id<"students">} id - The id of the student receiving points.
 * @param {string} reason - The reason for the points.
 * @param {number} severity - The number of points to assign.
 *
 * @throws - An error if the student cannot be found.
 * @returns {null} - Returns null when the points are created successfully.
 */
export const giveManualPoints = mutation({
	args: {
		id: v.id("students"),
		reason: v.string(),
		severity: v.number(),
	},
	handler: async (ctx, { id, reason, severity }) => {
		await requireRole(ctx, ["super-admin", "admin", "internal"]);

		if (!(await ctx.db.get(id))) {
			throw new ConvexError(`Studenten med ID ${id} ble ikke funnet.`);
		}

		await givePoints(ctx, { studentId: id, reason, severity });
	},
});

export const sendPointEmails = internalMutation({
	args: {
		pointId: v.id("points"),
	},
	handler: async (ctx, { pointId }) => {
		const point = await ctx.db.get(pointId);
		if (!point) return;

		const student = await ctx.db.get(point.studentId);
		const user = student && (await ctx.db.get(student.userId));
		if (!user) {
			throw new Error(`No user found for point ${pointId}.`);
		}

		await ctx.scheduler.runAfter(0, internal.emails.sendGottenPointsEmail, {
			participantEmail: user.email,
			severity: point.severity,
			reason: point.reason,
		});

		if (await hasTooManyPoints(ctx, point.studentId)) {
			await ctx.scheduler.runAfter(0, internal.emails.sendTooManyPointsEmail, {
				participantEmail: user.email,
			});
		}
	},
});

/**
 * Deletes a points record by id.
 *
 * @param {Id<"points">} id - The id of the points record to delete.
 *
 * @throws - An error if the current user cannot be resolved.
 * @returns {null} - Returns null when the points record is deleted successfully.
 */
export const remove = mutation({
	args: {
		id: v.id("points"),
	},
	handler: async (ctx, { id }) => {
		await requireRole(ctx, adminRoles);

		await ctx.db.delete(id);
	},
});

/**
 * Deletes points records older than roughly six months.
 *
 * @returns {null} - Returns null when the cleanup has completed.
 */
export const checkIfAnyPointsShouldBeRemoved = internalMutation({
	handler: async (ctx) => {
		const points = await ctx.db
			.query("points")
			.withIndex("by_creation_time", (q) => q.lt("_creationTime", Date.now() - POINT_LIFETIME_MS))
			.collect();

		await Promise.all(points.map((point) => ctx.db.delete(point._id)));
	},
});
