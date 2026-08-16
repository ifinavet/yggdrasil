import { DEV_USERS } from "@workspace/shared/constants";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

const SEED_COMPANIES = [
	{
		orgNumber: 810514442,
		name: "Nordlys Teknologi",
		description: "Et oppdiktet konsulentselskap som brukes til lokal utvikling.",
		mainSponsor: true,
		colour: "#1f3a8a",
	},
	{
		orgNumber: 923609016,
		name: "Fjordfrakt Data",
		description: "Et oppdiktet produktselskap som brukes til lokal utvikling.",
		mainSponsor: false,
		colour: "#0f766e",
	},
] as const;

const DAY = 24 * 60 * 60 * 1000;

function assertSeedingAllowed(): void {
	if (process.env.LOCAL_DEVELOPMENT !== "true") {
		throw new Error(
			"Seeding is only allowed on local development deployments. Run `pnpm setup:local`, which sets LOCAL_DEVELOPMENT on the deployment it creates.",
		);
	}
}

function placeholderLogo(name: string, colour: string): Blob {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${colour}"/><text x="128" y="128" fill="#ffffff" font-family="sans-serif" font-size="120" font-weight="bold" text-anchor="middle" dominant-baseline="central">${name.charAt(0)}</text></svg>`;

	return new Blob([svg], { type: "image/svg+xml" });
}

export const isSeeded = internalQuery({
	args: {},
	handler: async (ctx) => {
		const first = DEV_USERS[0];
		if (!first) return true;

		const existing = await ctx.db
			.query("users")
			.withIndex("by_ExternalId", (q) => q.eq("externalId", first.externalId))
			.unique();

		return existing !== null;
	},
});

export const insertSeedData = internalMutation({
	args: { logoStorageIds: v.array(v.id("_storage")) },
	handler: async (ctx, { logoStorageIds }) => {
		assertSeedingAllowed();

		const userIds: Id<"users">[] = [];
		for (const user of DEV_USERS) {
			const userId = await ctx.db.insert("users", {
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				image: "",
				externalId: user.externalId,
				locked: false,
			});
			userIds.push(userId);

			await ctx.db.insert("students", {
				userId,
				name: `${user.firstName} ${user.lastName}`,
				studyProgram: user.studyProgram,
				degree: user.degree,
				year: user.year,
			});

			if (user.role) {
				await ctx.db.insert("accessRights", { userId, role: user.role });
			}
		}

		const companyIds: Id<"companies">[] = [];
		for (const [index, company] of SEED_COMPANIES.entries()) {
			const logoStorageId = logoStorageIds[index];
			if (!logoStorageId) {
				throw new Error(`Missing a stored logo for the seeded company ${company.name}`);
			}

			const logo = await ctx.db.insert("companyLogos", {
				name: `${company.name} logo`,
				image: logoStorageId,
			});

			companyIds.push(
				await ctx.db.insert("companies", {
					orgNumber: company.orgNumber,
					name: company.name,
					description: company.description,
					mainSponsor: company.mainSponsor,
					logo,
				}),
			);
		}

		const now = Date.now();
		const events = [
			{
				title: "Bedriftspresentasjon med Nordlys Teknologi",
				teaser: "Bli kjent med konsulenthverdagen over en pizza.",
				eventStart: now + 7 * DAY,
				registrationOpens: now - DAY,
				company: 0,
				slug: "nordlys-bedriftspresentasjon",
			},
			{
				title: "Kurskveld: Fra idé til produksjon",
				teaser: "Praktisk kveld om hvordan et produkt havner i drift.",
				eventStart: now + 21 * DAY,
				registrationOpens: now + 7 * DAY,
				company: 1,
				slug: "fjordfrakt-kurskveld",
			},
			{
				title: "Karrieredagen 2025",
				teaser: "Et arrangement som allerede har vært, for å teste historikk.",
				eventStart: now - 14 * DAY,
				registrationOpens: now - 30 * DAY,
				company: 0,
				slug: "karrieredagen-2025",
			},
		];

		for (const event of events) {
			const hostingCompany = companyIds[event.company];
			if (!hostingCompany) {
				throw new Error(`Missing a seeded company for the event ${event.title}`);
			}

			await ctx.db.insert("events", {
				title: event.title,
				teaser: event.teaser,
				description: `<p>${event.teaser}</p><p>Dette arrangementet er opprettet av seed-dataene for lokal utvikling.</p>`,
				eventStart: event.eventStart,
				registrationOpens: event.registrationOpens,
				participationLimit: 30,
				location: "Ole-Johan Dahls hus",
				food: "Pizza",
				language: "Norsk",
				ageRestriction: "Ingen",
				hostingCompany,
				published: true,
				slug: event.slug,
			});
		}

		const listings = [
			{
				title: "Sommerjobb som utvikler",
				type: "Sommerjobb",
				company: 0,
				deadline: now + 30 * DAY,
			},
			{
				title: "Fast stilling som backendutvikler",
				type: "Fastjobb",
				company: 1,
				deadline: now + 60 * DAY,
			},
		];

		for (const listing of listings) {
			const company = companyIds[listing.company];
			if (!company) {
				throw new Error(`Missing a seeded company for the job listing ${listing.title}`);
			}

			const listingId = await ctx.db.insert("jobListings", {
				title: listing.title,
				type: listing.type,
				teaser: "Oppdiktet stillingsannonse for lokal utvikling.",
				description: "<p>Oppdiktet stillingsannonse for lokal utvikling.</p>",
				applicationUrl: "https://example.com/soknad",
				published: true,
				company,
				deadline: listing.deadline,
			});

			await ctx.db.insert("jobListingContacts", {
				listingId,
				name: "Kari Kontakt",
				email: "kari@example.com",
			});
		}

		return null;
	},
});

export const seedLocalDeployment = internalAction({
	args: {},
	handler: async (ctx): Promise<null> => {
		assertSeedingAllowed();

		if (await ctx.runQuery(internal.seed.isSeeded, {})) {
			console.info("Seed data already present, skipping.");
			return null;
		}

		const logoStorageIds = await Promise.all(
			SEED_COMPANIES.map((company) =>
				ctx.storage.store(placeholderLogo(company.name, company.colour)),
			),
		);

		await ctx.runMutation(internal.seed.insertSeedData, { logoStorageIds });
		console.info(
			`Seeded ${DEV_USERS.length} users, ${SEED_COMPANIES.length} companies and demo content.`,
		);

		return null;
	},
});
