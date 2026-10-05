import { posthogUnregistrationsSchema } from "@workspace/shared/engagement";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { registrationStatusValidator } from "../events/schema";
import { initialChangeOf } from "./backfill";
import { logStartedAt } from "./queries";

const POSTHOG_QUERY_URL = "https://eu.posthog.com/api/projects/82325/query/";
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const BATCH_SIZE = 100;
const TIMEOUT_MS = 30_000;
const MAX_LOGS_PER_REGISTRATION = 100;

const UNREGISTRATIONS_QUERY = `
	select
		properties.deletedRegistration.eventId,
		properties.deletedRegistration.userId,
		properties.deletedRegistration.status,
		toFloat(properties.deletedRegistration.registrationTime),
		toUnixTimestamp(timestamp) * 1000
	from events
	where event = 'midgard-student_unregister'
		and properties.$host in ('ifinavet.no', 'www.ifinavet.no')
	order by timestamp, uuid
	limit ${PAGE_SIZE}`;

async function fetchPage(key: string, offset: number) {
	const response = await fetch(POSTHOG_QUERY_URL, {
		method: "POST",
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			query: { kind: "HogQLQuery", query: `${UNREGISTRATIONS_QUERY} offset ${offset}` },
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`PostHog responded with ${response.status}`);
	return posthogUnregistrationsSchema.parse(await response.json()).results;
}

export const run = internalAction({
	args: {},
	handler: async (ctx) => {
		try {
			const key = process.env.POSTHOG_PERSONAL_API_KEY;
			if (!key) throw new Error("POSTHOG_PERSONAL_API_KEY is not set");
			for (let page = 0; page < MAX_PAGES; page += 1) {
				const results = await fetchPage(key, page * PAGE_SIZE);
				const rows = results.filter((row) => row !== null);
				if (results.length > 0 && rows.length === 0) {
					throw new Error("PostHog returned no readable unregistrations");
				}
				for (let start = 0; start < rows.length; start += BATCH_SIZE) {
					await ctx.runMutation(internal.engagement.unregistrationImport.apply, {
						rows: rows.slice(start, start + BATCH_SIZE),
					});
				}
				if (results.length < PAGE_SIZE) {
					await ctx.runMutation(internal.engagement.unregistrationImport.finish, {
						state: "done",
					});
					return;
				}
			}
			throw new Error("PostHog returned more pages than expected");
		} catch (error) {
			await ctx.runMutation(internal.engagement.unregistrationImport.finish, { state: "failed" });
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

export const apply = internalMutation({
	args: {
		rows: v.array(
			v.object({
				eventId: v.string(),
				userId: v.string(),
				status: registrationStatusValidator,
				registrationTime: v.number(),
				at: v.number(),
			}),
		),
	},
	handler: async (ctx, { rows }) => {
		const logStart = await logStartedAt(ctx);
		for (const row of rows) {
			if (logStart !== null && row.at >= logStart) continue;
			const eventId = ctx.db.normalizeId("events", row.eventId);
			const userId = ctx.db.normalizeId("users", row.userId);
			if (!eventId || !userId) continue;
			const event = await ctx.db.get(eventId);
			if (!event || !(await ctx.db.get(userId))) continue;
			if (row.registrationTime < event.registrationOpens || row.at > event.eventStart) continue;
			const logged = await ctx.db
				.query("registrationLog")
				.withIndex("by_eventId_and_userId", (q) => q.eq("eventId", eventId).eq("userId", userId))
				.take(MAX_LOGS_PER_REGISTRATION);
			if (hasLeft(logged, row.registrationTime)) continue;
			if (!logged.some(({ at }) => at === row.registrationTime)) {
				await ctx.db.insert("registrationLog", {
					eventId,
					userId,
					change: initialChangeOf(row.status),
					at: row.registrationTime,
				});
			}
			await ctx.db.insert("registrationLog", {
				eventId,
				userId,
				change: "unregistered",
				fromStatus: row.status,
				at: row.at,
			});
		}
	},
});

export const expire = internalMutation({
	args: { attempts: v.number() },
	handler: async (ctx, { attempts }) => {
		const current = await ctx.db.query("unregistrationImports").first();
		if (current?.state !== "running" || current.attempts !== attempts) return;
		await ctx.db.patch(current._id, { state: "failed" });
	},
});

export const finish = internalMutation({
	args: { state: v.union(v.literal("done"), v.literal("failed")) },
	handler: async (ctx, { state }) => {
		const current = await ctx.db.query("unregistrationImports").first();
		if (current) await ctx.db.patch(current._id, { state });
	},
});
