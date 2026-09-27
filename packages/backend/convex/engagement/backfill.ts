import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { migrations } from "../migrations";
import type { RegistrationChange } from "./schema";

export function initialChangeOf(status: Doc<"registrations">["status"]): RegistrationChange {
	return status === "registered" ? "registered" : "waitlisted";
}

export const backfillRegistrationLog = migrations.define({
	table: "registrations",
	migrateOne: async (ctx, registration) => {
		const logged = await ctx.db
			.query("registrationLog")
			.withIndex("by_eventId_and_userId", (q) =>
				q.eq("eventId", registration.eventId).eq("userId", registration.userId),
			)
			.first();
		if (logged) return;
		await ctx.db.insert("registrationLog", {
			eventId: registration.eventId,
			userId: registration.userId,
			change: initialChangeOf(registration.status),
			at: registration.registrationTime,
		});
	},
});

const BACKFILL = internal.engagement.backfill.backfillRegistrationLog;

export const pending = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const [status] = await migrations.getStatus(ctx, { migrations: [BACKFILL] });
		return status?.state !== "success";
	},
});

export const setup = mutation({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		await migrations.runOne(ctx, BACKFILL);
	},
});
