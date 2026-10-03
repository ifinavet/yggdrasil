import { DAY_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { logoSvg, requireLocal } from "../products/localSeed";

// Deterministic local examples. Changes are actual registration log entries,
// including cancelled seats and waitlist acceptances, not precomputed charts.
const SCENARIOS = [
	{
		name: "Fjordkode",
		title: "Sterk etterspørsel og ny vekst",
		initial: 40,
		next: 10,
		before: 15,
		cancellations: 25,
		recovery: 35,
	},
	{
		name: "Daldata",
		title: "Avmeldinger helt frem til start",
		initial: 20,
		next: 15,
		before: 5,
		cancellations: 20,
		recovery: -10,
	},
] as const;

async function seedEvent(
	ctx: MutationCtx,
	companyId: Id<"companies">,
	userIds: Id<"users">[],
	scenario: (typeof SCENARIOS)[number],
	eventStart: number,
	now: number,
) {
	const eventId = await ctx.db.insert("events", {
		title: scenario.title,
		teaser: "Lokale eksempeldata",
		description: "Lokale eksempeldata for påmeldingsprognosen.",
		eventStart,
		registrationOpens: eventStart - 14 * DAY_MS,
		participationLimit: 80,
		location: "IFI",
		language: "Norsk",
		ageRestriction: "Ingen",
		externalEvent: false,
		hostingCompany: companyId,
		published: true,
		remindersEnabled: true,
	});
	await Promise.all(
		(["week", "twoDays"] as const).flatMap((kind) => {
			const queuedAt = eventStart - (kind === "week" ? 7 : 2) * DAY_MS;
			return queuedAt <= now ? [ctx.db.insert("eventReminders", { eventId, kind, queuedAt })] : [];
		}),
	);
	const { entries, seated } = registrationData(eventId, userIds, scenario, eventStart, now);
	await Promise.all(entries.map((entry) => ctx.db.insert("registrationLog", entry)));
	await Promise.all(
		[...seated].map(([userId, registrationTime]) =>
			ctx.db.insert("registrations", {
				eventId,
				userId,
				status: "registered",
				registrationTime,
			}),
		),
	);
	return eventId;
}

function registrationData(
	eventId: Id<"events">,
	userIds: Id<"users">[],
	scenario: (typeof SCENARIOS)[number],
	eventStart: number,
	now: number,
) {
	const entries: Omit<Doc<"registrationLog">, "_id" | "_creationTime">[] = [];
	const seated = new Map<Id<"users">, number>();
	let nextUser = 0;
	const changes = [
		{ days: 13, delta: scenario.initial },
		{ days: 8, delta: scenario.next },
		{ days: 6.9, delta: -5 },
		{ days: 4.5, delta: scenario.before },
		{ days: 1.9, delta: -scenario.cancellations },
		{ days: 1, delta: scenario.recovery },
	]
		.flatMap(({ days, delta }) =>
			Array.from({ length: Math.abs(delta) }, (_, index) => ({
				at: eventStart - days * DAY_MS,
				cancel: delta < 0,
				promoted: days === 1 && index < 10,
			})),
		)
		.filter(({ at }) => at <= now);
	for (const { at, cancel, promoted } of changes) {
		if (cancel) {
			const userId = seated.keys().next().value;
			if (!userId) throw new Error("Preview cancellation has no seat");
			seated.delete(userId);
			entries.push({ eventId, userId, at, change: "unregistered", fromStatus: "registered" });
			continue;
		}
		const userId = userIds[nextUser++];
		if (!userId) throw new Error("Preview has too few users");
		if (promoted)
			entries.push(
				{ eventId, userId, at: at - DAY_MS, change: "waitlisted" },
				{ eventId, userId, at: at - 1000, change: "offered", fromStatus: "waitlist" },
			);
		entries.push({ eventId, userId, at, change: promoted ? "accepted" : "registered" });
		seated.set(userId, at);
	}
	return { entries, seated };
}

export const seed = internalAction({
	args: {},
	handler: async (ctx): Promise<unknown> => {
		requireLocal();
		const image = await ctx.storage.store(
			new Blob([logoSvg("Demo", 220)], { type: "image/svg+xml" }),
		);
		return ctx.runMutation(internal.engagement.forecastSeed.insert, { image });
	},
});

export const insert = internalMutation({
	args: { image: v.id("_storage") },
	handler: async (ctx, { image }) => {
		requireLocal();
		const existing = await ctx.db
			.query("companies")
			.withIndex("by_orgNumber", (q) => q.eq("orgNumber", 915000001))
			.first();
		if (existing) {
			await ctx.storage.delete(image);
			return { alreadySeeded: true };
		}
		const logo = await ctx.db.insert("companyLogos", { name: "Forecast preview", image });
		const now = Date.now();
		const users = await Promise.all(
			Array.from({ length: 110 }, async (_, index) => {
				const userId = await ctx.db.insert("users", {
					externalId: `forecast-${index}`,
					firstName: `Student ${index}`,
					lastName: "Eksempel",
					email: `forecast-${index}@example.test`,
					image: "",
					locked: false,
				});
				await ctx.db.insert("students", {
					userId,
					name: `Student ${index} Eksempel`,
					studyProgram: "Informatikk: programmering og systemarkitektur",
					year: (index % 3) + 1,
					degree: "Bachelor",
				});
				return userId;
			}),
		);
		const eventIds = await Promise.all(
			SCENARIOS.map(async (scenario, index) => {
				const companyId = await ctx.db.insert("companies", {
					name: scenario.name,
					orgNumber: 915000001 + index,
					description: "Lokale eksempeldata",
					mainSponsor: false,
					logo,
				});
				await Promise.all(
					Array.from({ length: 6 }, (_, sample) =>
						seedEvent(ctx, companyId, users, scenario, now - (20 + sample * 20) * DAY_MS, now),
					),
				);
				return seedEvent(ctx, companyId, users, scenario, now + 4 * DAY_MS, now);
			}),
		);
		const companyId = await ctx.db.insert("companies", {
			name: "Ny bedrift",
			orgNumber: 915000003,
			description: "Lokale eksempeldata",
			mainSponsor: false,
			logo,
		});
		const sparse = await seedEvent(ctx, companyId, users, SCENARIOS[1], now + 5 * DAY_MS, now);
		await ctx.db.patch(sparse, {
			title: "For lite historikk",
			remindersEnabled: false,
			participationLimit: 200,
		});
		const sparseReminder = await ctx.db
			.query("eventReminders")
			.withIndex("by_eventId_and_kind", (q) => q.eq("eventId", sparse).eq("kind", "week"))
			.unique();
		if (sparseReminder) await ctx.db.delete(sparseReminder._id);
		eventIds.push(sparse);
		return { eventIds };
	},
});
