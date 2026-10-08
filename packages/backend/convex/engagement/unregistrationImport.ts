import { posthogUnregistrationsSchema } from "@workspace/shared/engagement";
import { type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { registrationStatusValidator } from "../events/schema";
import { initialChangeOf } from "./backfill";
import { dropCheckpoints } from "./checkpoints";
import { dropEventCurve } from "./curves";
import { logStartedAt } from "./queries";

const POSTHOG_QUERY_URL = "https://eu.posthog.com/api/projects/82325/query/";
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const BATCH_SIZE = 100;
const TIMEOUT_MS = 30_000;
const MAX_LOGS_PER_REGISTRATION = 100;
const MAX_ERROR_LENGTH = 300;
const EXPIRED_ERROR = "The import did not report back before its deadline";
const START = { at: 0, uuid: "" };

const UNREGISTRATIONS_QUERY = `
	select
		properties.deletedRegistration.eventId,
		properties.deletedRegistration.userId,
		properties.deletedRegistration.status,
		toFloat(properties.deletedRegistration.registrationTime),
		toUnixTimestamp(timestamp) * 1000,
		toString(uuid)
	from events
	where event = 'midgard-student_unregister'
		and properties.$host in ('ifinavet.no', 'www.ifinavet.no')
		and (toUnixTimestamp(timestamp) * 1000, toString(uuid)) > ({at}, {uuid})
	order by toUnixTimestamp(timestamp) * 1000, toString(uuid)
	limit ${PAGE_SIZE}`;

async function fetchPage(key: string, after: typeof START) {
	const response = await fetch(POSTHOG_QUERY_URL, {
		method: "POST",
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			query: { kind: "HogQLQuery", query: UNREGISTRATIONS_QUERY, values: after },
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) {
		const reason = await response.text().catch(() => "");
		throw new Error(`PostHog responded with ${response.status} ${reason}`.trim());
	}
	return posthogUnregistrationsSchema.parse(await response.json()).results;
}

export const run = internalAction({
	args: {},
	handler: async (ctx) => {
		try {
			const key = process.env.POSTHOG_PERSONAL_API_KEY;
			if (!key) throw new Error("POSTHOG_PERSONAL_API_KEY is not set");
			let imported = 0;
			let after = START;
			for (let page = 0; page < MAX_PAGES; page += 1) {
				const results = await fetchPage(key, after);
				const rows = results.flatMap((result) => (result ? [result.row] : []));
				if (results.length > 0 && rows.length === 0) {
					throw new Error("PostHog returned no readable unregistrations");
				}
				const batches = Array.from({ length: Math.ceil(rows.length / BATCH_SIZE) }, (_, index) =>
					rows.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
				);
				const added: number[] = await Promise.all(
					batches.map((batch) =>
						ctx.runMutation(internal.engagement.unregistrationImport.apply, { rows: batch }),
					),
				);
				imported += added.reduce((sum, count) => sum + count, 0);
				if (results.length < PAGE_SIZE) {
					await ctx.runMutation(internal.engagement.unregistrationImport.finish, {
						state: "done",
						imported,
					});
					return;
				}
				const last = results.at(-1);
				if (!last) throw new Error("PostHog returned a page that cannot be continued");
				after = last.position;
			}
			throw new Error("PostHog returned more pages than expected");
		} catch (error) {
			await ctx.runMutation(internal.engagement.unregistrationImport.finish, {
				state: "failed",
				error: String(error).slice(0, MAX_ERROR_LENGTH),
			});
			throw error;
		}
	},
});

function hasLeft(
	logged: readonly Pick<Doc<"registrationLog">, "change" | "at">[],
	registrationTime: number,
) {
	return logged.some(
		(exit) =>
			exit.change === "unregistered" &&
			exit.at >= registrationTime &&
			!logged.some(
				(entry) =>
					entry.change !== "unregistered" && entry.at > registrationTime && entry.at <= exit.at,
			),
	);
}

const rowValidator = v.object({
	eventId: v.string(),
	userId: v.string(),
	status: registrationStatusValidator,
	registrationTime: v.number(),
	at: v.number(),
});

type Row = Infer<typeof rowValidator>;
type Registration = { eventId: string; userId: string; rows: Row[] };

async function applyTo(
	ctx: MutationCtx,
	registration: Registration,
): Promise<{ count: number; eventId: Id<"events"> | null }> {
	const eventId = ctx.db.normalizeId("events", registration.eventId);
	const userId = ctx.db.normalizeId("users", registration.userId);
	if (!eventId || !userId) return { count: 0, eventId: null };
	const [event, user, logged] = await Promise.all([
		ctx.db.get(eventId),
		ctx.db.get(userId),
		ctx.db
			.query("registrationLog")
			.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", eventId).eq("userId", userId))
			.take(MAX_LOGS_PER_REGISTRATION),
	]);
	if (!event || !user) return { count: 0, eventId: null };
	const known: Pick<Doc<"registrationLog">, "change" | "at">[] = [...logged];
	const added: Pick<Doc<"registrationLog">, "change" | "fromStatus" | "at">[] = [];
	for (const row of registration.rows) {
		if (row.registrationTime < event.registrationOpens || row.at > event.eventStart) continue;
		if (hasLeft(known, row.registrationTime)) continue;
		const entries = [
			...(known.some(({ at }) => at === row.registrationTime)
				? []
				: [{ change: initialChangeOf(row.status), at: row.registrationTime }]),
			{ change: "unregistered" as const, fromStatus: row.status, at: row.at },
		];
		known.push(...entries);
		added.push(...entries);
	}
	await Promise.all(
		added.map((entry) => ctx.db.insert("registrationLog", { eventId, userId, ...entry })),
	);
	return { count: added.length, eventId: added.length > 0 ? eventId : null };
}

export const apply = internalMutation({
	args: { rows: v.array(rowValidator) },
	handler: async (ctx, { rows }) => {
		const logStart = await logStartedAt(ctx);
		const registrations = new Map<string, Registration>();
		for (const row of rows) {
			if (logStart !== null && row.at >= logStart) continue;
			const key = `${row.eventId}:${row.userId}`;
			const registration = registrations.get(key) ?? {
				eventId: row.eventId,
				userId: row.userId,
				rows: [],
			};
			registration.rows.push(row);
			registrations.set(key, registration);
		}
		const applied = await Promise.all(
			[...registrations.values()].map((registration) => applyTo(ctx, registration)),
		);
		const touched = new Set(applied.flatMap(({ eventId }) => (eventId ? [eventId] : [])));
		for (const eventId of touched) {
			await dropCheckpoints(ctx, eventId);
			await dropEventCurve(ctx, eventId);
			await ctx.scheduler.runAfter(0, internal.engagement.stats.refreshStats, { eventId });
		}
		return applied.reduce((sum, { count }) => sum + count, 0);
	},
});

export const expire = internalMutation({
	args: { attempts: v.number() },
	handler: async (ctx, { attempts }) => {
		const current = await ctx.db.query("unregistrationImports").first();
		if (current?.state !== "running" || current.attempts !== attempts) return;
		await ctx.db.patch(current._id, { state: "failed", error: EXPIRED_ERROR });
	},
});

export const finish = internalMutation({
	args: {
		state: v.union(v.literal("done"), v.literal("failed")),
		imported: v.optional(v.number()),
		error: v.optional(v.string()),
	},
	handler: async (ctx, { state, imported, error }) => {
		const current = await ctx.db.query("unregistrationImports").first();
		if (current) await ctx.db.patch(current._id, { state, imported, error });
	},
});
