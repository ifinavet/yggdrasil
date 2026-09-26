import { STUDY_PROGRAMS } from "@workspace/shared/constants";
import {
	DAY_MS,
	eventSemesterOf,
	eventSemesterRange,
	formatOsloDate,
	MINUTE_MS,
	osloDateTimeToEpoch,
} from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { logoSvg, randomTools, requireLocal, seededRandom } from "../products/localSeed";

const COMPANIES = [
	{ name: "Kvitfjell Kode", popularity: 1.35 },
	{ name: "Brattli Consulting", popularity: 1.2 },
	{ name: "Nordhav Bank", popularity: 1.15 },
	{ name: "Solvik Energi", popularity: 1.05 },
	{ name: "Lysaker Systems", popularity: 0.95 },
	{ name: "Stryn Software", popularity: 0.85 },
	{ name: "Gaular Data", popularity: 0.8 },
	{ name: "Hardanger Cloud", popularity: 0.7 },
	{ name: "Vestby Security", popularity: 0.65 },
	{ name: "Tromsdal Analytics", popularity: 0.55 },
] as const;

const FIRST_ORG_NUMBER = 913_000_000;
const STUDENT_COUNT = 300;
const PASSIVE_STUDENT_COUNT = 450;
const ACTIVE_PROGRAM_SKEW = 1.6;
const PASSIVE_PROGRAM_SKEW = 1.1;
const PARTICIPATION_LIMITS = [30, 40, 40, 60, 60, 80, 100];
const EVENT_KINDS = ["Bedriftspresentasjon", "Workshop", "Fagkveld", "Lunsjforedrag", "Case-kveld"];
const TIMESLOTS = [
	{ time: "12:15", appeal: 0.8 },
	{ time: "16:15", appeal: 1.05 },
	{ time: "17:15", appeal: 1.1 },
	{ time: "18:15", appeal: 0.9 },
] as const;
const WEEKDAY_APPEAL: Record<number, number> = { 1: 0.9, 2: 1.05, 3: 1, 4: 1.05, 5: 0.7 };
const YEAR_WEIGHTS = [
	{ year: 1, share: 0.22, eagerness: 0.4 },
	{ year: 2, share: 0.24, eagerness: 1.1 },
	{ year: 3, share: 0.24, eagerness: 1.3 },
	{ year: 4, share: 0.16, eagerness: 1.2 },
	{ year: 5, share: 0.14, eagerness: 0.9 },
];
const FIRST_NAMES = [
	"Ingrid",
	"Emma",
	"Nora",
	"Sara",
	"Maja",
	"Ida",
	"Thea",
	"Sofie",
	"Hedda",
	"Tiril",
	"Jakob",
	"Emil",
	"Noah",
	"Oliver",
	"Filip",
	"Lukas",
	"Henrik",
	"Aksel",
	"Magnus",
	"Sander",
];
const LAST_NAMES = [
	"Hansen",
	"Johansen",
	"Olsen",
	"Larsen",
	"Andersen",
	"Pedersen",
	"Nilsen",
	"Kristiansen",
	"Jensen",
	"Karlsen",
	"Berg",
	"Haugen",
	"Hagen",
	"Bakken",
	"Solberg",
	"Lie",
	"Moen",
	"Dahl",
];

type Random = ReturnType<typeof randomTools>;
type Foundation = { companyIds: Id<"companies">[]; userIds: Id<"users">[] };
type Registrant = { userId: Id<"users">; at: number };

const osloDay = (at: number) => formatOsloDate(at, "yyyy-MM-dd");
const osloTime = (at: number, time: string) => osloDateTimeToEpoch(osloDay(at), time);

function weightedSample<T>(
	random: Random,
	items: readonly T[],
	weight: (item: T) => number,
	count: number,
) {
	return items
		.map((item) => ({ item, key: random.next() ** (1 / weight(item)) }))
		.sort((a, b) => b.key - a.key)
		.slice(0, count)
		.map(({ item }) => item);
}

export const seedLocalEngagement = internalAction({
	handler: async (ctx): Promise<{ events: number; alerts: number } | null> => {
		requireLocal();
		const logoIds: Id<"_storage">[] = [];
		for (const [index, { name }] of COMPANIES.entries()) {
			const hue = Math.round((index * 360) / COMPANIES.length + 20);
			logoIds.push(
				await ctx.storage.store(new Blob([logoSvg(name, hue)], { type: "image/svg+xml" })),
			);
		}
		const foundation: Foundation | null = await ctx.runMutation(
			internal.engagement.localSeed.insertFoundation,
			{ logoIds },
		);
		if (!foundation) return null;

		const now = Date.now();
		const current = eventSemesterOf(now);
		const previous = eventSemesterOf(
			eventSemesterRange(current.semester, current.year).start - DAY_MS,
		);
		const lastYear = eventSemesterOf(now - 365 * DAY_MS);
		let events = 0;
		for (const [index, semester] of [lastYear, previous, current].entries()) {
			const range = eventSemesterRange(semester.semester, semester.year);
			events += await ctx.runMutation(internal.engagement.localSeed.insertPastEvents, {
				...foundation,
				from: range.start,
				until: Math.min(range.end, now - DAY_MS),
				seed: 7 + index,
			});
		}
		events += await ctx.runMutation(internal.engagement.localSeed.insertLiveEvents, {
			...foundation,
			now,
		});
		const alerts: number = await ctx.runMutation(internal.engagement.alerts.detectAlerts, {});
		return { events, alerts };
	},
});

export const insertFoundation = internalMutation({
	args: { logoIds: v.array(v.id("_storage")) },
	handler: async (ctx, { logoIds }): Promise<Foundation | null> => {
		requireLocal();
		const alreadySeeded = await ctx.db
			.query("companies")
			.withIndex("by_orgNumber", (q) => q.eq("orgNumber", FIRST_ORG_NUMBER))
			.first();
		if (alreadySeeded) return null;

		const random = randomTools(seededRandom(314));
		const companyIds: Id<"companies">[] = [];
		for (const [index, { name }] of COMPANIES.entries()) {
			const logo = await ctx.db.insert("companyLogos", {
				name,
				image: logoIds[index] as Id<"_storage">,
			});
			companyIds.push(
				await ctx.db.insert("companies", {
					orgNumber: FIRST_ORG_NUMBER + index,
					name,
					description: `${name} er en fiktiv bedrift laget for lokal utvikling.`,
					mainSponsor: index === 0,
					logo,
				}),
			);
		}

		const insertStudent = async (index: number, programSkew: number) => {
			const firstName = random.pick(FIRST_NAMES);
			const lastName = random.pick(LAST_NAMES);
			const userId = await ctx.db.insert("users", {
				email: `${firstName}.${lastName}.${index}@student.example`.toLowerCase(),
				firstName,
				lastName,
				image: "",
				externalId: `local-engagement-${index}`,
				locked: false,
			});
			const year = weightedSample(random, YEAR_WEIGHTS, ({ share }) => share, 1)[0]?.year ?? 1;
			const programIndex = Math.min(
				STUDY_PROGRAMS.length - 1,
				Math.floor(random.next() ** programSkew * STUDY_PROGRAMS.length),
			);
			await ctx.db.insert("students", {
				userId,
				name: `${firstName} ${lastName}`,
				studyProgram: STUDY_PROGRAMS[programIndex] as string,
				year,
				degree: year <= 3 ? "Bachelor" : "Master",
			});
			return userId;
		};

		const userIds: Id<"users">[] = [];
		for (let index = 0; index < STUDENT_COUNT; index++) {
			userIds.push(await insertStudent(index, ACTIVE_PROGRAM_SKEW));
		}
		for (let index = STUDENT_COUNT; index < STUDENT_COUNT + PASSIVE_STUDENT_COUNT; index++) {
			await insertStudent(index, PASSIVE_PROGRAM_SKEW);
		}
		return { companyIds, userIds };
	},
});

async function eagernessByUser(ctx: MutationCtx, userIds: Id<"users">[]) {
	const eagerness = new Map<Id<"users">, number>();
	for (const userId of userIds) {
		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		const weights = YEAR_WEIGHTS.find(({ year }) => year === student?.year);
		eagerness.set(userId, weights?.eagerness ?? 1);
	}
	return eagerness;
}

type EventPlan = {
	companyIndex: number;
	title: string;
	eventStart: number;
	registrationOpens: number;
	participationLimit: number;
	location?: string;
};

async function insertEvent(ctx: MutationCtx, companyIds: Id<"companies">[], plan: EventPlan) {
	const company = COMPANIES[plan.companyIndex] as (typeof COMPANIES)[number];
	return await ctx.db.insert("events", {
		title: plan.title,
		teaser: `Bli kjent med ${company.name}.`,
		description: `Lokale testdata for ${company.name}.`,
		eventStart: plan.eventStart,
		registrationOpens: plan.registrationOpens,
		participationLimit: plan.participationLimit,
		location: plan.location ?? "Store auditorium, IFI",
		food: "Pizza",
		language: "Norsk",
		ageRestriction: "Ingen",
		externalEvent: false,
		hostingCompany: companyIds[plan.companyIndex] as Id<"companies">,
		published: true,
	});
}

async function register(
	ctx: MutationCtx,
	eventId: Id<"events">,
	{ userId, at }: Registrant,
	status: "registered" | "waitlist",
) {
	const registrationId = await ctx.db.insert("registrations", {
		eventId,
		userId,
		status,
		registrationTime: at,
	});
	await ctx.db.insert("registrationLog", {
		eventId,
		userId,
		change: status === "registered" ? "registered" : "waitlisted",
		at,
	});
	return registrationId;
}

function frontLoadedTimes(
	random: Random,
	opens: number,
	closes: number,
	count: number,
	steepness: number,
) {
	return Array.from(
		{ length: count },
		() => opens + (closes - opens) * random.next() ** steepness,
	).sort((a, b) => a - b);
}

export const insertPastEvents = internalMutation({
	args: {
		companyIds: v.array(v.id("companies")),
		userIds: v.array(v.id("users")),
		from: v.number(),
		until: v.number(),
		seed: v.number(),
	},
	handler: async (ctx, { companyIds, userIds, from, until, seed }) => {
		requireLocal();
		const random = randomTools(seededRandom(seed));
		const eagerness = await eagernessByUser(ctx, userIds);
		let events = 0;
		for (let day = from; day < until; day += DAY_MS) {
			const weekday = Number(formatOsloDate(day, "i"));
			const appeal = WEEKDAY_APPEAL[weekday];
			if (appeal === undefined || random.next() > 0.32) continue;

			const companyIndex = weightedSample(
				random,
				[...COMPANIES.keys()],
				(index) => COMPANIES[index]?.popularity ?? 1,
				1,
			)[0] as number;
			const slot = random.pick(TIMESLOTS);
			const eventStart = osloTime(day, slot.time);
			const registrationOpens = osloTime(eventStart - 14 * DAY_MS, "12:00");
			const participationLimit = random.pick(PARTICIPATION_LIMITS);
			const company = COMPANIES[companyIndex] as (typeof COMPANIES)[number];
			const interest = company.popularity * slot.appeal * appeal * (0.55 + random.next() * 0.55);
			const interested = Math.min(userIds.length, Math.round(participationLimit * interest));
			const registeredCount = Math.min(participationLimit, interested);

			const eventId = await insertEvent(ctx, companyIds, {
				companyIndex,
				title: `${random.pick(EVENT_KINDS)} med ${company.name}`,
				eventStart,
				registrationOpens,
				participationLimit,
			});
			const people = weightedSample(
				random,
				userIds,
				(userId) => eagerness.get(userId) ?? 1,
				interested + 3,
			);
			const steepness = interest > 1 ? 4 : 2;
			const times = frontLoadedTimes(random, registrationOpens, eventStart, interested, steepness);
			const attendanceRate =
				0.86 - ((day - from) / DAY_MS / 120) * 0.12 + (random.next() - 0.5) * 0.08;

			for (const [index, userId] of people.slice(0, interested).entries()) {
				const at = times[index] as number;
				const status = index < registeredCount ? "registered" : "waitlist";
				const registrationId = await register(ctx, eventId, { userId, at }, status);
				if (status !== "registered") continue;
				const roll = random.next();
				await ctx.db.patch(registrationId, {
					attendanceStatus:
						roll < attendanceRate ? "confirmed" : roll < attendanceRate + 0.06 ? "late" : "no_show",
					attendanceTime: eventStart + Math.floor(random.next() * 20) * MINUTE_MS,
				});
			}

			const lateLeavers = random.between({ min: 0, max: 3 });
			for (const userId of people.slice(interested, interested + lateLeavers)) {
				const joined = registrationOpens + random.next() * DAY_MS;
				const left = eventStart - (1 + random.next() * 20) * 60 * MINUTE_MS;
				await ctx.db.insert("registrationLog", {
					eventId,
					userId,
					change: "registered",
					at: joined,
				});
				await ctx.db.insert("registrationLog", {
					eventId,
					userId,
					change: "unregistered",
					fromStatus: "registered",
					at: left,
				});
			}
			events++;
		}
		return events;
	},
});

export const insertLiveEvents = internalMutation({
	args: {
		companyIds: v.array(v.id("companies")),
		userIds: v.array(v.id("users")),
		now: v.number(),
	},
	handler: async (ctx, { companyIds, userIds, now }) => {
		requireLocal();
		const random = randomTools(seededRandom(99));
		const eagerness = await eagernessByUser(ctx, userIds);
		const crowd = (count: number, excluded: Id<"users">[] = []) =>
			weightedSample(
				random,
				userIds.filter((userId) => !excluded.includes(userId)),
				(userId) => eagerness.get(userId) ?? 1,
				count,
			);
		const inDays = (days: number, time: string) => osloTime(now + days * DAY_MS, time);

		const codeNightOpens = inDays(-1, "12:00");
		const codeNight = await insertEvent(ctx, companyIds, {
			companyIndex: 0,
			title: "Kodekveld",
			eventStart: inDays(5, "17:15"),
			registrationOpens: codeNightOpens,
			participationLimit: 80,
		});
		const codeNightCrowd = crowd(109);
		const fullTimes = frontLoadedTimes(
			random,
			codeNightOpens,
			codeNightOpens + 9 * MINUTE_MS,
			80,
			1.4,
		);
		for (const [index, userId] of codeNightCrowd.slice(0, 80).entries()) {
			await register(ctx, codeNight, { userId, at: fullTimes[index] as number }, "registered");
		}
		for (const [index, userId] of codeNightCrowd.slice(80).entries()) {
			await register(
				ctx,
				codeNight,
				{ userId, at: codeNightOpens + (10 + index * 17) * MINUTE_MS },
				"waitlist",
			);
		}

		const presentationOpens = inDays(-6, "12:00");
		const presentation = await insertEvent(ctx, companyIds, {
			companyIndex: 1,
			title: "Bedriftspresentasjon",
			eventStart: inDays(4, "16:15"),
			registrationOpens: presentationOpens,
			participationLimit: 60,
		});
		const presentationCrowd = crowd(52, codeNightCrowd);
		const presentationTimes = frontLoadedTimes(
			random,
			presentationOpens,
			now - 3 * 60 * MINUTE_MS,
			52,
			2.2,
		);
		const leavers = presentationCrowd.slice(0, 11);
		for (const [index, userId] of presentationCrowd.entries()) {
			const at = presentationTimes[index] as number;
			if (index >= leavers.length) {
				await register(ctx, presentation, { userId, at }, "registered");
				continue;
			}
			const left = now - (40 - index * 3.5) * MINUTE_MS;
			await ctx.db.insert("registrationLog", {
				eventId: presentation,
				userId,
				change: "registered",
				at,
			});
			await ctx.db.insert("registrationLog", {
				eventId: presentation,
				userId,
				change: "unregistered",
				fromStatus: "registered",
				at: left,
			});
			if (index % 2 === 0 && index < 10) {
				await register(
					ctx,
					codeNight,
					{ userId, at: left + (2 + index / 2) * MINUTE_MS },
					"waitlist",
				);
			}
		}

		const plans: (EventPlan & { registered: number; steepness: number })[] = [
			{
				companyIndex: 6,
				title: "Workshop i skyarkitektur",
				eventStart: inDays(2, "12:15"),
				registrationOpens: inDays(-10, "12:00"),
				participationLimit: 40,
				registered: 15,
				steepness: 1,
			},
			{
				companyIndex: 4,
				title: "Lunsjforedrag",
				eventStart: inDays(12, "12:15"),
				registrationOpens: inDays(2, "12:00"),
				participationLimit: 60,
				registered: 0,
				steepness: 1,
			},
			{
				companyIndex: 2,
				title: "Fagkveld om betalingssystemer",
				eventStart: inDays(10, "17:15"),
				registrationOpens: inDays(-4, "12:00"),
				participationLimit: 100,
				registered: 88,
				steepness: 3,
			},
			{
				companyIndex: 3,
				title: "Case-kveld",
				eventStart: inDays(8, "18:15"),
				registrationOpens: inDays(-3, "12:00"),
				participationLimit: 40,
				registered: 21,
				steepness: 2.5,
			},
			{
				companyIndex: 9,
				title: "Workshop i dataanalyse",
				eventStart: inDays(11, "16:15"),
				registrationOpens: inDays(-2, "12:00"),
				participationLimit: 30,
				registered: 0,
				steepness: 1,
			},
		];
		for (const plan of plans) {
			const eventId = await insertEvent(ctx, companyIds, plan);
			const closes = Math.min(now - MINUTE_MS, plan.eventStart);
			const times = frontLoadedTimes(
				random,
				plan.registrationOpens,
				closes,
				plan.registered,
				plan.steepness,
			);
			for (const [index, userId] of crowd(plan.registered).entries()) {
				await register(ctx, eventId, { userId, at: times[index] as number }, "registered");
			}
		}
		return plans.length + 2;
	},
});
