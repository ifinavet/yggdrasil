import { api } from "@workspace/backend/convex/api";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../packages/backend/convex/_generated/dataModel";
import { LocalDatabase, localAdmin } from "./seed-database";

const DAY = 24 * 60 * 60 * 1000;
const seedOrgNumber = 995000000;
const pixel = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	),
	(char) => char.codePointAt(0) ?? 0,
);

export type InsightSeedScenario = "empty" | "single" | "full";

export const insightSeedTitles = {
	lead: "Seed workshop med Kvitfjell",
	helper: "Seed fagkveld med Nordhav",
	other: "Seed lunsjforedrag med Solvik",
} as const;

async function clearInsights(db: LocalDatabase) {
	const companies = (await db.all("companies")).filter(
		({ orgNumber }) => orgNumber >= seedOrgNumber && orgNumber < seedOrgNumber + 100,
	);
	const companyIds = new Set(companies.map(({ _id }) => _id));
	const events = (await db.all("events")).filter(({ hostingCompany }) =>
		companyIds.has(hostingCompany),
	);
	const eventIds = new Set(events.map(({ _id }) => _id));
	await Promise.all(
		(["registrationLog", "registrations", "eventOrganizers", "engagementAlerts"] as const).map(
			async (table) => {
				const rows = (await db.all(table)).filter(({ eventId }) => eventIds.has(eventId));
				if (!rows.length) return;
				await db.call("_system/frontend/deleteDocuments", {
					toDelete: rows.map(({ _id }) => ({ id: _id, tableName: table })),
				});
			},
		),
	);
	await Promise.all(events.map(({ _id }) => db.delete("events", _id)));
	await Promise.all(companies.map(({ _id }) => db.delete("companies", _id)));
}

async function logo(url: string, db: LocalDatabase) {
	const client = new ConvexHttpClient(url);
	const uploadUrl = await client.mutation(api.companies.mutations.generateUploadUrl, {});
	const response = await fetch(uploadUrl, {
		method: "POST",
		headers: { "Content-Type": "image/png" },
		body: pixel,
	});
	const { storageId } = (await response.json()) as { storageId: string };
	return db.insert("companyLogos", { name: "Seed", image: storageId as never });
}

function registrationTimes(opens: number, until: number, count: number) {
	return Array.from(
		{ length: count },
		(_, index) => opens + ((until - opens) * (index + 1)) / (count + 1),
	);
}

async function insertEvent(
	db: LocalDatabase,
	userId: Id<"users">,
	company: Id<"companies">,
	event: { title: string; start: number; opens: number; registered: number; past: boolean },
	now: number,
) {
	const eventId = await db.insert("events", {
		title: event.title,
		teaser: "Lokale eksempeldata",
		description: "Lokale eksempeldata for innsikt.",
		eventStart: event.start,
		registrationOpens: event.opens,
		participationLimit: 40,
		location: "IFI",
		language: "Norsk",
		ageRestriction: "Ingen",
		externalEvent: false,
		hostingCompany: company,
		published: true,
		remindersEnabled: true,
	});
	const times = registrationTimes(
		event.opens,
		event.past ? event.start - DAY : now,
		event.registered,
	);
	await db.call("_system/frontend/addDocument", {
		table: "registrationLog",
		documents: times.map((at) => ({ eventId, userId, change: "registered", at })),
	});
	if (!event.past) {
		await db.call("_system/frontend/addDocument", {
			table: "registrations",
			documents: times.map((registrationTime) => ({
				eventId,
				userId,
				status: "registered",
				registrationTime,
			})),
		});
	}
	return eventId;
}

export async function seedInsights(url: string, scenario: InsightSeedScenario) {
	const db = new LocalDatabase(url);
	await clearInsights(db);
	const userId = await localAdmin(db);
	if (scenario === "empty") return;
	const now = Date.now();
	const logoId = await logo(url, db);
	const company = await db.insert("companies", {
		orgNumber: seedOrgNumber,
		name: "Seed Teknologi",
		description: "Eksempelbedrift",
		mainSponsor: false,
		logo: logoId,
	});
	await Promise.all(
		[2, 3, 4, 5].map((weeksAgo, index) => {
			const start = now - weeksAgo * 7 * DAY;
			return insertEvent(
				db,
				userId,
				company,
				{
					title: `Seed tidligere arrangement ${index + 1}`,
					start,
					opens: start - 14 * DAY,
					registered: 30,
					past: true,
				},
				now,
			);
		}),
	);
	const lead = await insertEvent(
		db,
		userId,
		company,
		{
			title: insightSeedTitles.lead,
			start: now + 5 * DAY,
			opens: now - 9 * DAY,
			registered: 12,
			past: false,
		},
		now,
	);
	await db.insert("eventOrganizers", { eventId: lead, userId, role: "hovedansvarlig" });
	if (scenario === "single") return;
	const helper = await insertEvent(
		db,
		userId,
		company,
		{
			title: insightSeedTitles.helper,
			start: now + 9 * DAY,
			opens: now - 5 * DAY,
			registered: 6,
			past: false,
		},
		now,
	);
	await db.insert("eventOrganizers", { eventId: helper, userId, role: "medhjelper" });
	await insertEvent(
		db,
		userId,
		company,
		{
			title: insightSeedTitles.other,
			start: now + 12 * DAY,
			opens: now - 2 * DAY,
			registered: 3,
			past: false,
		},
		now,
	);
	await db.insert("engagementAlerts", {
		eventId: helper,
		rule: "behindPace",
		summary: "Nordhav ligger an til 20 % fylt",
		detail: "6 av 40 plasser, 9 dager igjen.",
		triggeredAt: now - 60 * 60 * 1000,
	});
}
