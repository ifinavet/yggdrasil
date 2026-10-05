import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
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
const MAX_IMPORT_ATTEMPTS = 3;
const IMPORT_REVISION = 2;
const IMPORT_DEADLINE_MS = 15 * 60_000;

async function backfillPending(ctx: QueryCtx) {
	const [status] = await migrations.getStatus(ctx, { migrations: [BACKFILL] });
	return status?.state !== "success";
}

async function unregistrationImportOf(ctx: QueryCtx) {
	return await ctx.db.query("unregistrationImports").first();
}

function isCurrentRevision(current: Doc<"unregistrationImports">) {
	return current.revision === IMPORT_REVISION;
}

function importPending(current: Doc<"unregistrationImports"> | null) {
	if (!process.env.POSTHOG_PERSONAL_API_KEY) return false;
	if (!current || !isCurrentRevision(current)) return true;
	return current.state === "failed" && current.attempts < MAX_IMPORT_ATTEMPTS;
}

export const pending = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		if (await backfillPending(ctx)) return true;
		return importPending(await unregistrationImportOf(ctx));
	},
});

export const importOutcome = query({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		const current = await unregistrationImportOf(ctx);
		if (!current || !isCurrentRevision(current)) return null;
		const { state, attempts, imported, error } = current;
		return { state, attempts, imported, error };
	},
});

export const setup = mutation({
	args: {},
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);
		await migrations.runOne(ctx, BACKFILL);
		if (await backfillPending(ctx)) return;
		const current = await unregistrationImportOf(ctx);
		if (!importPending(current)) return;
		const attempts = current && isCurrentRevision(current) ? current.attempts + 1 : 1;
		const next = { state: "running" as const, attempts, revision: IMPORT_REVISION };
		if (current) {
			await ctx.db.patch(current._id, { ...next, imported: undefined, error: undefined });
		} else {
			await ctx.db.insert("unregistrationImports", next);
		}
		await ctx.scheduler.runAfter(0, internal.engagement.unregistrationImport.run, {});
		await ctx.scheduler.runAfter(
			IMPORT_DEADLINE_MS,
			internal.engagement.unregistrationImport.expire,
			{ attempts },
		);
	},
});
