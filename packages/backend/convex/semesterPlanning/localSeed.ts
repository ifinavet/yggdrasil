import { MIDGARD_URL } from "@workspace/shared/constants";
import { osloDateTimeToEpoch, presentationDaysBetween } from "@workspace/shared/time";
import { type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { generateLinkToken } from "../lib/tokens";
import { logoSvg, requireLocal } from "../products/localSeed";
import { CONSENT_VERSION, FORM_VERSION } from "./rules";
import { findSemester } from "./semesters/helper";

// Local test data for Semesterplan: an autumn 2026 semester with events already in the calendar
// (to try the import and the manual add), a spring 2027 semester with applications in every
// status, and both open for applications so Hugin shows the semester choice. Run with
// `npx convex run semesterPlanning/localSeed:seedLocalSemesterPlanning`. Only on a local backend.

const COMPANIES = [
	"Fjordkode",
	"Nordlys Data",
	"Bergverk Systems",
	"Havbris Analytics",
	"Tindesoft",
	"Skarv Consulting",
	"Polarsky",
	"Granitt Security",
] as const;

const FIRST_ORG_NUMBER = 914_000_000;

const MEMBERS = [
	{ firstName: "Kari", lastName: "Nordmann", position: "Bedriftskontakt", role: "editor" },
	{ firstName: "Ola", lastName: "Hansen", position: "Arrangementsansvarlig", role: "internal" },
	{ firstName: "Ingrid", lastName: "Solberg", position: "Styremedlem", role: "internal" },
	{ firstName: "Emil", lastName: "Moe", position: "Styremedlem", role: "internal" },
	{ firstName: "Ida", lastName: "Berg", position: "Økonomiansvarlig", role: "internal" },
] as const;

const AUTUMN_2026 = {
	firstDate: "2026-08-18",
	lastDate: "2026-11-26",
	applicationDeadline: "2026-06-05",
	closed: { "2026-08-18": "Kickoff", "2026-10-15": "Høstfest" },
	// Calendar events made before Semesterplan existed: on Tuesdays, Thursdays and one Wednesday.
	events: [
		{ date: "2026-08-25", time: "16:15", company: 0, published: true },
		{ date: "2026-09-01", time: "16:15", company: 1, published: true },
		{ date: "2026-09-10", time: "17:00", company: 2, published: true },
		{ date: "2026-09-16", time: "16:15", company: 3, published: true }, // Wednesday
		{ date: "2026-09-24", time: "16:15", company: 4, published: true },
		{ date: "2026-10-06", time: "16:15", company: 5, published: true },
		{ date: "2026-10-22", time: "16:15", company: 6, published: false },
		{ date: "2026-11-05", time: "16:15", company: 7, published: true },
		{ date: "2026-11-19", time: "16:15", company: 0, published: false },
	],
} as const;

const SPRING_2027 = {
	firstDate: "2027-01-19",
	lastDate: "2027-05-06",
	applicationDeadline: "2026-12-04",
	closed: { "2027-01-19": "Kickoff", "2027-03-04": "dagen@ifi" },
} as const;

type Status = Doc<"companyApplications">["status"];

type SeedApplication = {
	company: number;
	status: Status;
	availableDates: string[];
	assignedDate?: string;
	eventType?: Doc<"companyApplications">["eventType"];
	maxStudents?: number;
	team?: { responsible: number; helpers: number[] };
	/** Only for offer_sent and new_date_requested: an offer with this state. */
	offer?: "pending" | "new_date_requested";
	requestedDates?: string[];
};

const SPRING_APPLICATIONS: SeedApplication[] = [
	{ company: 0, status: "applied", availableDates: ["2027-01-26", "2027-02-02", "2027-02-09"] },
	{ company: 1, status: "applied", availableDates: ["2027-02-11", "2027-02-18"] },
	{
		company: 2,
		status: "applied",
		availableDates: ["2027-03-09", "2027-03-11", "2027-03-16"],
		eventType: "workshop",
		maxStudents: 30,
	},
	{
		company: 3,
		status: "offer_sent",
		availableDates: ["2027-02-02", "2027-02-04"],
		assignedDate: "2027-02-04",
		offer: "pending",
	},
	{
		company: 4,
		status: "new_date_requested",
		availableDates: ["2027-02-16", "2027-02-23"],
		assignedDate: "2027-02-16",
		offer: "new_date_requested",
		requestedDates: ["2027-02-23"],
	},
	{
		company: 5,
		status: "confirmed",
		availableDates: ["2027-03-02", "2027-03-09"],
		assignedDate: "2027-03-02",
		team: { responsible: 1, helpers: [2] },
		eventType: "large_presentation",
		maxStudents: 80,
	},
	{
		company: 6,
		status: "confirmed",
		availableDates: ["2027-04-08", "2027-04-13"],
		assignedDate: "2027-04-13",
		team: { responsible: 3, helpers: [] },
	},
	{ company: 7, status: "declined", availableDates: ["2027-04-20"], assignedDate: undefined },
];

// Late applications for the running semester, so the chooser on Hugin has something behind it.
const AUTUMN_APPLICATIONS: SeedApplication[] = [
	{ company: 3, status: "applied", availableDates: ["2026-11-10", "2026-11-12"] },
	{ company: 6, status: "applied", availableDates: ["2026-11-24"], eventType: "social" },
];

const countsValidator = v.object({
	companies: v.number(),
	members: v.number(),
	semesters: v.number(),
	events: v.number(),
	applications: v.number(),
});
type Counts = Infer<typeof countsValidator>;

export const seedLocalSemesterPlanning = internalAction({
	args: {},
	returns: countsValidator,
	handler: async (ctx): Promise<Counts> => {
		requireLocal();
		const logoIds: Id<"_storage">[] = [];
		for (const [index, name] of COMPANIES.entries()) {
			const hue = Math.round((index * 360) / COMPANIES.length + 40);
			logoIds.push(
				await ctx.storage.store(new Blob([logoSvg(name, hue)], { type: "image/svg+xml" })),
			);
		}
		return await ctx.runMutation(internal.semesterPlanning.localSeed.insertLocalSemesterPlanning, {
			logoIds,
		});
	},
});

export const insertLocalSemesterPlanning = internalMutation({
	args: { logoIds: v.array(v.id("_storage")) },
	returns: countsValidator,
	handler: async (ctx, { logoIds }): Promise<Counts> => {
		requireLocal();
		const alreadySeeded = await ctx.db
			.query("companies")
			.withIndex("by_orgNumber", (q) => q.eq("orgNumber", FIRST_ORG_NUMBER))
			.first();
		if (alreadySeeded) {
			return { companies: 0, members: 0, semesters: 0, events: 0, applications: 0 };
		}

		const companyIds = await insertCompanies(ctx, logoIds);
		const memberIds = await insertMembers(ctx);

		const autumn = await upsertSemester(ctx, 2026, "autumn", AUTUMN_2026);
		const spring = await upsertSemester(ctx, 2027, "spring", SPRING_2027);
		if (!(await findSemester(ctx, 2027, "autumn"))) {
			await ctx.db.insert("semesters", {
				year: 2027,
				term: "autumn",
				status: "draft",
				termsUrl: `${MIDGARD_URL}/vilkar`,
				defaultEventStartTime: "16:15",
			});
		}

		let events = 0;
		for (const [index, event] of AUTUMN_2026.events.entries()) {
			const company = COMPANIES[event.company];
			const companyId = companyIds[event.company] as Id<"companies">;
			const eventStart = osloDateTimeToEpoch(event.date, event.time);
			const eventId = await ctx.db.insert("events", {
				title: `Bedriftspresentasjon med ${company}`,
				teaser: `Bli kjent med ${company}.`,
				description: `Lokale testdata for ${company}.`,
				eventStart,
				registrationOpens: eventStart - 14 * 24 * 60 * 60 * 1000,
				participationLimit: [30, 40, 40, 60][index % 4] as number,
				location: "Store auditorium, IFI",
				language: "Norsk",
				ageRestriction: "Ingen",
				externalEvent: false,
				hostingCompany: companyId,
				published: event.published,
			});
			await ctx.db.insert("eventOrganizers", {
				eventId,
				userId: memberIds[index % memberIds.length] as Id<"users">,
				role: "hovedansvarlig",
			});
			if (index % 2 === 0) {
				await ctx.db.insert("eventOrganizers", {
					eventId,
					userId: memberIds[(index + 1) % memberIds.length] as Id<"users">,
					role: "medhjelper",
				});
			}
			events++;
		}

		let applications = 0;
		for (const seed of SPRING_APPLICATIONS) {
			await insertApplication(ctx, spring, seed, memberIds);
			applications++;
		}
		for (const seed of AUTUMN_APPLICATIONS) {
			await insertApplication(ctx, autumn, seed, memberIds);
			applications++;
		}

		return {
			companies: companyIds.length,
			members: memberIds.length,
			semesters: 3,
			events,
			applications,
		};
	},
});

async function insertCompanies(ctx: MutationCtx, logoIds: Id<"_storage">[]) {
	const companyIds: Id<"companies">[] = [];
	for (const [index, name] of COMPANIES.entries()) {
		const logo = await ctx.db.insert("companyLogos", {
			name,
			image: logoIds[index] as Id<"_storage">,
		});
		companyIds.push(
			await ctx.db.insert("companies", {
				orgNumber: FIRST_ORG_NUMBER + index,
				name,
				description: `${name} er en fiktiv bedrift laget for lokal utvikling.`,
				mainSponsor: false,
				logo,
			}),
		);
	}
	return companyIds;
}

async function insertMembers(ctx: MutationCtx) {
	const memberIds: Id<"users">[] = [];
	for (const [index, member] of MEMBERS.entries()) {
		const userId = await ctx.db.insert("users", {
			email: `${member.firstName}.${member.lastName}@ifinavet.no`.toLowerCase(),
			firstName: member.firstName,
			lastName: member.lastName,
			image: "",
			externalId: `local-semester-member-${index}`,
			locked: false,
		});
		await ctx.db.insert("accessRights", { userId, role: member.role });
		await ctx.db.insert("internals", { userId, position: member.position, group: "Styret" });
		memberIds.push(userId);
	}
	return memberIds;
}

type SemesterSeed = {
	firstDate: string;
	lastDate: string;
	applicationDeadline: string;
	closed: Readonly<Record<string, string>>;
};

/** Creates the semester, or fills in the one the rollover job made, and opens it. */
async function upsertSemester(
	ctx: MutationCtx,
	year: number,
	term: Doc<"semesters">["term"],
	seed: SemesterSeed,
): Promise<Id<"semesters">> {
	const fields = {
		firstDate: seed.firstDate,
		lastDate: seed.lastDate,
		applicationDeadline: seed.applicationDeadline,
		hardDeadline: false,
		status: "open" as const,
		infoText:
			"Vi setter opp bedriftspresentasjoner på tirsdager og torsdager. Skriv gjerne hvilke datoer som passer best.",
		termsUrl: `${MIDGARD_URL}/vilkar`,
		defaultEventStartTime: "16:15",
	};
	const existing = await findSemester(ctx, year, term);
	let semesterId: Id<"semesters">;
	if (existing) {
		await ctx.db.patch(existing._id, fields);
		semesterId = existing._id;
	} else {
		semesterId = await ctx.db.insert("semesters", { year, term, ...fields });
	}

	const present = new Set(
		(
			await ctx.db
				.query("semesterDates")
				.withIndex("by_semesterId_and_date", (q) => q.eq("semesterId", semesterId))
				.collect()
		).map((date) => date.date),
	);
	for (const date of presentationDaysBetween(seed.firstDate, seed.lastDate)) {
		if (present.has(date)) continue;
		const closedLabel = seed.closed[date];
		await ctx.db.insert("semesterDates", {
			semesterId,
			date,
			...(closedLabel !== undefined ? { closedLabel } : {}),
		});
	}
	return semesterId;
}

async function insertApplication(
	ctx: MutationCtx,
	semesterId: Id<"semesters">,
	seed: SeedApplication,
	memberIds: Id<"users">[],
) {
	const company = COMPANIES[seed.company] as string;
	const contactFirst = ["Anne", "Per", "Lise", "Jonas", "Marte", "Sindre", "Eva", "Tor"][
		seed.company
	] as string;
	const applicationId = await ctx.db.insert("companyApplications", {
		semesterId,
		submissionId: `local-seed-${semesterId}-${seed.company}`,
		formVersion: FORM_VERSION,
		orgNumber: String(FIRST_ORG_NUMBER + seed.company),
		registry: {
			name: `${company.toUpperCase()} AS`,
			organizationForm: { code: "AS", description: "Aksjeselskap" },
			businessAddress: { addressLines: ["Storgata 12"], postalCode: "0155", city: "OSLO" },
			industry: { code: "62.100", description: "Programmeringstjenester" },
			employeeCount: 20 + seed.company * 15,
			fetchedAt: Date.now(),
		},
		contact: {
			name: `${contactFirst} ${company.split(" ")[0]}sen`,
			email: `${contactFirst.toLowerCase()}@${company.toLowerCase().replaceAll(/\s+/g, "")}.no`,
			phone: "+47 412 34 567",
		},
		eventType: seed.eventType ?? "standard_presentation",
		minStudents: 20,
		maxStudents: seed.maxStudents ?? 40,
		description: `Presentasjon av ${company} med case og pizza.`,
		availableDates: seed.availableDates,
		venue: "campus",
		wantsToUseEscape: "unsure",
		foodAndDrinks: true,
		foodPurchasedBy: "company",
		billing: {
			email: `faktura@${company.toLowerCase().replaceAll(/\s+/g, "")}.no`,
			ehfInvoice: false,
		},
		targetDegrees: ["Bachelor", "Master"],
		targetStudyPrograms: [],
		consent: { version: CONSENT_VERSION, consentedAt: Date.now() },
		status: seed.status,
		...(seed.assignedDate ? { assignedDate: seed.assignedDate } : {}),
		...(seed.team
			? {
					responsibleUserId: memberIds[seed.team.responsible] as Id<"users">,
					helperUserIds: seed.team.helpers.map((index) => memberIds[index] as Id<"users">),
				}
			: {}),
	});
	await ctx.db.insert("companyApplicationActivity", {
		applicationId,
		type: "submitted",
		actor: "company",
	});

	if (seed.offer && seed.assignedDate) {
		await ctx.db.insert("companyApplicationOffers", {
			applicationId,
			date: seed.assignedDate,
			eventType: seed.eventType ?? "standard_presentation",
			maxStudents: seed.maxStudents ?? 40,
			linkToken: generateLinkToken(),
			sentAt: Date.now(),
			sentBy: memberIds[0] as Id<"users">,
			status: seed.offer,
			...(seed.requestedDates ? { requestedDates: seed.requestedDates } : {}),
		});
	}
}
