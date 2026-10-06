import { localIdentity } from "@workspace/shared/local";
import type { Id } from "../../packages/backend/convex/_generated/dataModel";
import { LocalDatabase } from "./seed-database";

export type EventsSeedScenario = "empty" | "organizer" | "external";

const DAY = 24 * 60 * 60 * 1000;
const slugPrefix = "seed-events-";

async function localUser(db: LocalDatabase) {
	const existing = await db.find("users", "externalId", localIdentity.subject);
	const userId =
		existing?._id ??
		(await db.insert("users", {
			externalId: localIdentity.subject,
			firstName: localIdentity.givenName,
			lastName: localIdentity.familyName,
			email: localIdentity.email,
			image: localIdentity.profileUrl,
			locked: false,
		}));
	const rights = await db.find("accessRights", "userId", userId);
	if (!rights) await db.insert("accessRights", { userId, role: "super-admin" });
	return userId;
}

async function hostingCompany(db: LocalDatabase) {
	const existing = (await db.all("companies"))[0];
	if (existing) return existing._id;
	await db.call("engagement/localSeed:seedLocalEngagement", {});
	const seeded = (await db.all("companies"))[0];
	if (!seeded) throw new Error("Seed could not create a hosting company");
	return seeded._id;
}

async function clearEvents(db: LocalDatabase) {
	const seeded = (await db.all("events")).filter((event) => event.slug?.startsWith(slugPrefix));
	const ids = new Set(seeded.map((event) => event._id));
	await Promise.all(
		(["eventOrganizers", "registrations"] as const).map(async (table) => {
			const rows = (await db.all(table)).filter((row) => ids.has(row.eventId));
			await Promise.all(rows.map((row) => db.delete(table, row._id)));
		}),
	);
	await Promise.all(seeded.map((event) => db.delete("events", event._id)));
}

async function otherUser(db: LocalDatabase, index: number) {
	const externalId = `${slugPrefix}student-${index}`;
	const existing = await db.find("users", "externalId", externalId);
	if (existing) return existing._id;
	return await db.insert("users", {
		externalId,
		firstName: ["Ingrid", "Emma", "Nora"][index % 3] ?? "Student",
		lastName: "Hansen",
		email: `student-${index}@student.example`,
		image: "",
		locked: false,
	});
}

type EventPlan = {
	slug: string;
	title: string;
	startsInDays: number;
	published?: boolean;
	external?: boolean;
	mine?: boolean;
	registrations?: number;
};

async function insertEvent(db: LocalDatabase, company: Id<"companies">, plan: EventPlan) {
	const now = Date.now();
	return await db.insert("events", {
		title: plan.title,
		teaser: "Lokale testdata.",
		description: "Lokale testdata.",
		eventStart: now + plan.startsInDays * DAY,
		registrationOpens: now + (plan.startsInDays - 10) * DAY,
		participationLimit: 40,
		location: "Store auditorium, IFI",
		language: "Norsk",
		ageRestriction: "Ingen",
		externalEvent: plan.external ?? false,
		externalUrl: plan.external ? "https://example.com/arrangement" : undefined,
		hostingCompany: company,
		published: plan.published ?? true,
		slug: plan.slug,
	});
}

const scenarios: Record<Exclude<EventsSeedScenario, "empty">, EventPlan[]> = {
	organizer: [
		{
			slug: `${slugPrefix}mine`,
			title: "Kodekveld",
			startsInDays: 4,
			mine: true,
			registrations: 3,
		},
		{ slug: `${slugPrefix}other`, title: "Bedriftspresentasjon", startsInDays: 6 },
		{ slug: `${slugPrefix}past`, title: "Hackathon", startsInDays: -5 },
		{ slug: `${slugPrefix}draft`, title: "Workshop", startsInDays: 12, published: false },
	],
	external: [
		{
			slug: `${slugPrefix}external`,
			title: "Karrieredag",
			startsInDays: 4,
			external: true,
			mine: true,
		},
	],
};

export async function seedEvents(url: string, scenario: EventsSeedScenario) {
	const db = new LocalDatabase(url);
	await clearEvents(db);
	const me = await localUser(db);
	if (scenario === "empty") return null;
	const company = await hostingCompany(db);
	const plans = scenarios[scenario];
	const most = Math.max(0, ...plans.map((plan) => plan.registrations ?? 0));
	const students = await Promise.all(
		Array.from({ length: most }, (_, index) => otherUser(db, index)),
	);
	const entries = await Promise.all(
		plans.map(async (plan) => {
			const eventId = await insertEvent(db, company, plan);
			const rows: Promise<unknown>[] = [];
			if (plan.mine)
				rows.push(db.insert("eventOrganizers", { eventId, userId: me, role: "hovedansvarlig" }));
			for (let index = 0; index < (plan.registrations ?? 0); index++) {
				rows.push(
					db.insert("registrations", {
						eventId,
						userId: students[index],
						status: "registered",
						registrationTime: Date.now() - (index + 1) * DAY,
					}),
				);
			}
			await Promise.all(rows);
			return [plan.slug, eventId] as const;
		}),
	);
	return Object.fromEntries(entries) as Record<string, string>;
}
