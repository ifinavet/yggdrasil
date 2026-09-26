import { formatPercent } from "@workspace/shared/products";
import { DATE_PATTERNS, DAY_MS, formatOsloDate, MINUTE_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { companyWithLogo } from "../events/queries";
import type { AlertRule } from "./schema";
import { pastCurvesBefore, snapshotOf, upcomingEvents } from "./snapshot";

const EVENTS_TO_WATCH = 50;
const DEDUP_WINDOW_MS = DAY_MS;
const SLACK_ATTEMPTS = 3;
const SLACK_RETRY_STEP_MS = 5 * MINUTE_MS;

type Snapshot = Awaited<ReturnType<typeof snapshotOf>>;

const RULE_FOR_STATUS: Partial<Record<Snapshot["status"]["kind"], AlertRule>> = {
	wave: "unregisterWave",
	behind: "behindPace",
	noRegistrations: "noRegistrations",
};

function percent(fraction: number) {
	return formatPercent(fraction * 100);
}

function daysLeft(eventStart: number, now: number) {
	const days = Math.max(1, Math.ceil((eventStart - now) / DAY_MS));
	return days === 1 ? "1 dag igjen" : `${days} dager igjen`;
}

export function describeAlert(
	rule: AlertRule,
	event: Doc<"events">,
	companyName: string,
	snapshot: Snapshot,
	now: number,
) {
	const name = `${event.title}, ${companyName}`;
	const seats = `${snapshot.registered} av ${event.participationLimit} plasser`;
	if (rule === "unregisterWave") {
		const times = snapshot.unregistrations.map((entry) => entry.at);
		const minutes = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / MINUTE_MS));
		return {
			summary: `${times.length} avmeldinger på ${minutes} min på ${name}`,
			detail: `${seats} er fortsatt tatt.`,
		};
	}
	if (rule === "behindPace") {
		const comparison =
			snapshot.expectedFillNow === null
				? ""
				: ` Lignende arrangementer var ${percent(snapshot.expectedFillNow)} fylt på samme tidspunkt.`;
		return {
			summary: `${name} ligger an til ${percent(snapshot.projectedFill)} fylt`,
			detail: `${seats}, ${daysLeft(event.eventStart, now)}.${comparison}`,
		};
	}
	return {
		summary: `Ingen påmeldinger på ${name}`,
		detail: `Påmeldingen åpnet ${formatOsloDate(event.registrationOpens, DATE_PATTERNS.shortDate)}`,
	};
}

async function recentlyAlerted(
	ctx: MutationCtx,
	event: Doc<"events">,
	rule: AlertRule,
	now: number,
) {
	const latest = await ctx.db
		.query("engagementAlerts")
		.withIndex("by_eventId_and_rule", (q) => q.eq("eventId", event._id).eq("rule", rule))
		.order("desc")
		.first();
	return latest !== null && latest.triggeredAt > now - DEDUP_WINDOW_MS;
}

export const detectAlerts = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const pastCurves = await pastCurvesBefore(ctx, now);
		let triggered = 0;
		for (const event of await upcomingEvents(ctx, now, EVENTS_TO_WATCH)) {
			const snapshot = await snapshotOf(ctx, event, now, pastCurves);
			const rule = RULE_FOR_STATUS[snapshot.status.kind];
			if (!rule || (await recentlyAlerted(ctx, event, rule, now))) continue;

			const { name } = await companyWithLogo(ctx, event.hostingCompany);
			const { summary, detail } = describeAlert(rule, event, name, snapshot, now);
			await ctx.db.insert("engagementAlerts", {
				eventId: event._id,
				rule,
				summary,
				detail,
				triggeredAt: now,
			});
			await ctx.scheduler.runAfter(0, internal.engagement.alerts.notifySlack, {
				text: `${summary}\n${detail}`,
			});
			triggered++;
		}
		return triggered;
	},
});

export const notifySlack = internalAction({
	args: { text: v.string(), attempt: v.optional(v.number()) },
	handler: async (ctx, { text, attempt = 1 }) => {
		const webhookUrl = process.env.SLACK_ENGAGEMENT_WEBHOOK_URL;
		if (!webhookUrl) return false;
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
			signal: AbortSignal.timeout(10_000),
		}).catch(() => null);
		if (response?.ok) return true;
		if (attempt < SLACK_ATTEMPTS) {
			await ctx.scheduler.runAfter(
				attempt * SLACK_RETRY_STEP_MS,
				internal.engagement.alerts.notifySlack,
				{ text, attempt: attempt + 1 },
			);
		}
		throw new Error(`Slack svarte ${response?.status ?? "ikke"}`);
	},
});

export const dismissAlert = mutation({
	args: { alertId: v.id("engagementAlerts") },
	handler: async (ctx, { alertId }) => {
		await requireRole(ctx, internalRoles);
		await ctx.db.patch(alertId, { dismissedAt: Date.now() });
	},
});
