import { BIFROST_LOCAL_URL, BIFROST_URL } from "@workspace/shared/constants";
import { formatPercent } from "@workspace/shared/products";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { DATE_PATTERNS, DAY_MS, formatOsloDate, MINUTE_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { internalRoles, requireRole } from "../auth/accessRights";
import { isLocalDevelopment } from "../auth/local";
import { companyWithLogo, getOrganizers } from "../events/queries";
import { alertSentence, organizerNames, unregisterWaveText } from "../events/slack/messages";
import { queueEventNotification } from "../events/slack/state";
import type { AlertRule } from "./schema";
import { pastCurvesBefore, snapshotOf, upcomingEvents } from "./snapshot";

const EVENTS_TO_WATCH = 50;
const DEDUP_WINDOW_MS = DAY_MS;

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
): { summary: string; detail?: string } {
	const name = `${event.title}, ${companyName}`;
	if (rule === "unregisterWave") {
		const times = snapshot.unregistrations.map((entry) => entry.at);
		const minutes = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / MINUTE_MS));
		return {
			summary: `${times.length} avmeldinger på ${minutes} min på ${name}`,
		};
	}
	if (rule === "behindPace") {
		const comparison =
			snapshot.expectedFillNow === null
				? ""
				: ` Forventet på dette tidspunktet er ${percent(snapshot.expectedFillNow)} fylt.`;
		return {
			summary: `${name} ligger an til ${percent(snapshot.projectedFill)} fylt`,
			detail: `${daysLeft(event.eventStart, now)}.${comparison}`,
		};
	}
	return {
		summary: `Ingen påmeldinger på ${name}`,
		detail: `Påmeldingen åpnet ${formatOsloDate(event.registrationOpens, DATE_PATTERNS.shortDate)}`,
	};
}

const SLACK_INTRO: Record<AlertRule, { title: string; hint: string; tag: boolean }> = {
	unregisterWave: {
		title: "🏃💨 Mange meldte seg av på kort tid",
		hint: "Det kan bety at noe har endret seg, for eksempel tidspunkt, sted eller at noe annet kolliderer.",
		tag: false,
	},
	behindPace: {
		title: "🐢 Påmeldingen går tregere enn vanlig",
		hint: "Farten er sammenlignet med tidligere arrangementer. Kanskje verdt å dele arrangementet en gang til?",
		tag: false,
	},
	noRegistrations: {
		title: "🦗 Ingen har meldt seg på ennå",
		hint: "Sjekk at arrangementet er publisert og har blitt delt i kanalene våre.",
		tag: true,
	},
};

type Organizer = { name: string; slackUserId?: string };

export function slackText(
	rule: AlertRule,
	eventId: Doc<"events">["_id"],
	alert: { summary: string; detail?: string },
	organizers: Organizer[],
	origin: string,
) {
	const { title, hint, tag } = SLACK_INTRO[rule];
	return [
		title,
		alertSentence(alert.summary, alert.detail),
		...(organizers.length > 0
			? [`🙋 Hovedansvarlig: ${organizerNames(organizers, tag).join(", ")}`]
			: []),
		`💡 ${hint}`,
		`👉 <${origin}/events/${eventId}|Åpne arrangementet> · <${origin}/insight|Se innsikt>`,
	].join("\n");
}

async function mainOrganizers(ctx: MutationCtx, eventId: Doc<"events">["_id"]) {
	return (await getOrganizers(ctx, eventId)).filter(({ role }) => role === "hovedansvarlig");
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
		const origin = isLocalDevelopment() ? BIFROST_LOCAL_URL : BIFROST_URL;
		const triggered: { event: Doc<"events">; rule: AlertRule; summary: string; detail?: string }[] =
			[];
		for (const event of await upcomingEvents(ctx, now, EVENTS_TO_WATCH)) {
			const snapshot = await snapshotOf(ctx, event, now, pastCurves);
			const rule = RULE_FOR_STATUS[snapshot.status.kind];
			if (!rule || (await recentlyAlerted(ctx, event, rule, now))) continue;

			const { name } = await companyWithLogo(ctx, event.hostingCompany);
			triggered.push({ event, rule, ...describeAlert(rule, event, name, snapshot, now) });
		}
		await Promise.all(
			triggered.map(async ({ event, rule, summary, detail }) => {
				const [organizers] = await Promise.all([
					mainOrganizers(ctx, event._id),
					ctx.db.insert("engagementAlerts", {
						eventId: event._id,
						rule,
						summary,
						detail,
						triggeredAt: now,
					}),
				]);
				if (rule === "unregisterWave")
					await queueEventNotification(
						ctx,
						event._id,
						`unregister-wave:${now}`,
						unregisterWaveText(summary, detail),
					);
				await ctx.scheduler.runAfter(0, internal.iam.notifications.sendMessage, {
					channel: SYSTEM_ALERTS_CHANNEL,
					clientMsgId: `engagement-${event._id}-${rule}-${now}`,
					text: slackText(rule, event._id, { summary, detail }, organizers, origin),
				});
			}),
		);
		return triggered.length;
	},
});

export const dismissAlert = mutation({
	args: { alertId: v.id("engagementAlerts") },
	handler: async (ctx, { alertId }) => {
		await requireRole(ctx, internalRoles);
		await ctx.db.patch(alertId, { dismissedAt: Date.now() });
	},
});
