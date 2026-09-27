import { DAY_MS, eventSemesterRange, HOUR_MS } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { logoSvg, randomTools, requireLocal, seededRandom } from "../products/localSeed";

const COMPANY = { orgNumber: 914_000_000, name: "Pallen Parti AS" };
const INTERNALS = [
	{ firstName: "Kari", lastName: "Stamgjest", zeal: 0.95, grit: 0.35 },
	{ firstName: "Ola", lastName: "Pizzaslukern", zeal: 0.9, grit: 0.1 },
	{ firstName: "Mathilde", lastName: "Stolbærer", zeal: 0.6, grit: 0.9 },
	{ firstName: "Jonas", lastName: "Bordrigger", zeal: 0.55, grit: 0.75 },
	{ firstName: "Sigrid", lastName: "Mailvakt", zeal: 0.7, grit: 0.6 },
	{ firstName: "Eirik", lastName: "Kaffekoker", zeal: 0.8, grit: 0.45 },
	{ firstName: "Ingeborg", lastName: "Navnelapp", zeal: 0.5, grit: 0.5 },
	{ firstName: "Torstein", lastName: "Garderobe", zeal: 0.45, grit: 0.3 },
	{ firstName: "Live", lastName: "Mikrofon", zeal: 0.65, grit: 0.25 },
	{ firstName: "Håkon", lastName: "Skjermdeler", zeal: 0.4, grit: 0.4 },
	{ firstName: "Amalie", lastName: "Oppmøte", zeal: 0.35, grit: 0.15 },
	{ firstName: "Viktor", lastName: "Sistemann", zeal: 0.25, grit: 0.2 },
	{ firstName: "Nina", lastName: "Sofasitter", zeal: 0.15, grit: 0.05 },
	{ firstName: "Per", lastName: "Spøkelse", zeal: 0, grit: 0 },
] as const;
const EVENTS_PER_SEMESTER = 9;
const EVENT_TITLES = [
	"Pizzakveld",
	"Bedpres",
	"Workshop",
	"Fagkveld",
	"Lunsjforedrag",
	"Case-kveld",
];

type Semester = { start: number; end: number };

function recentSemesters(now: number): Semester[] {
	const year = new Date(now).getFullYear();
	return [
		eventSemesterRange("vår", year - 1),
		eventSemesterRange("høst", year - 1),
		eventSemesterRange("vår", year),
		eventSemesterRange("høst", year),
	].filter(({ start }) => start < now);
}

export const seedLocalLeaderboard = internalAction({
	args: {},
	handler: async (ctx): Promise<{ events: number }> => {
		requireLocal();
		const logoId = await ctx.storage.store(
			new Blob([logoSvg(COMPANY.name, 42)], { type: "image/svg+xml" }),
		);
		return await ctx.runMutation(internal.leaderboard.localSeed.insertLeaderboard, {
			logoId,
			now: Date.now(),
		});
	},
});

export const insertLeaderboard = internalMutation({
	args: { logoId: v.id("_storage"), now: v.number() },
	handler: async (ctx, { logoId, now }) => {
		requireLocal();
		const alreadySeeded = await ctx.db
			.query("companies")
			.withIndex("by_orgNumber", (q) => q.eq("orgNumber", COMPANY.orgNumber))
			.first();
		if (alreadySeeded) return { events: 0 };

		const random = randomTools(seededRandom(2718));
		const logo = await ctx.db.insert("companyLogos", { name: COMPANY.name, image: logoId });
		const hostingCompany = await ctx.db.insert("companies", {
			orgNumber: COMPANY.orgNumber,
			name: COMPANY.name,
			description: `${COMPANY.name} finnes bare lokalt.`,
			mainSponsor: false,
			logo,
		});

		const members: { userId: Id<"users">; zeal: number; grit: number }[] = [];
		for (const [index, { firstName, lastName, zeal, grit }] of INTERNALS.entries()) {
			const userId = await ctx.db.insert("users", {
				email: `${firstName}.${lastName}@internal.example`.toLowerCase(),
				firstName,
				lastName,
				image: "",
				externalId: `local-leaderboard-${index}`,
				locked: false,
			});
			await ctx.db.insert("internals", { userId, position: "Styremedlem", group: "Styret" });
			members.push({ userId, zeal, grit });
		}

		let events = 0;
		for (const { start, end } of recentSemesters(now)) {
			const lastStart = Math.min(end, now) - DAY_MS;
			for (let index = 0; index < EVENTS_PER_SEMESTER; index++) {
				const eventStart =
					start + Math.floor(((lastStart - start) * (index + 0.5)) / EVENTS_PER_SEMESTER);
				const eventId = await ctx.db.insert("events", {
					title: `${random.pick(EVENT_TITLES)} med ${COMPANY.name}`,
					teaser: "Lokale testdata for leaderboardet.",
					description: "Lokale testdata for leaderboardet.",
					eventStart: eventStart + 17 * HOUR_MS,
					registrationOpens: eventStart - 7 * DAY_MS,
					participationLimit: 60,
					location: "Store auditorium, IFI",
					food: "Pizza",
					language: "Norsk",
					ageRestriction: "Ingen",
					externalEvent: false,
					hostingCompany,
					published: true,
				});
				events++;

				const organizers = members.filter(({ grit }) => random.next() < grit * 0.5).slice(0, 3);
				for (const [position, { userId }] of organizers.entries()) {
					await ctx.db.insert("eventOrganizers", {
						eventId,
						userId,
						role: position === 0 ? "hovedansvarlig" : "medhjelper",
					});
				}

				for (const { userId, zeal } of members) {
					if (random.next() >= zeal) continue;
					const roll = random.next();
					await ctx.db.insert("registrations", {
						eventId,
						userId,
						status: "registered",
						registrationTime: eventStart - DAY_MS,
						attendanceStatus: roll < 0.85 ? "confirmed" : roll < 0.93 ? "late" : "no_show",
					});
				}
			}
		}
		return { events };
	},
});
