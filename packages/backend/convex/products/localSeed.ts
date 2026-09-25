import { eventSemesterRange } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";
import { snapshotOf } from "./sales";
import { SEED_PRODUCT_NAMES } from "./seed";

const COMPANY_NAMES = [
	"Fjordkode",
	"Nordlys Data",
	"Bergverk Systems",
	"Havbris Analytics",
	"Tindesoft",
	"Skarv Consulting",
	"Polarsky",
	"Granitt Security",
	"Lynx Labs",
	"Elvebakken Digital",
	"Stavkirke Software",
	"Kvasir AI",
	"Midnattsol Tech",
	"Trollheim Cloud",
	"Sildre Robotics",
	"Vardø Finans",
	"Rimfrost Games",
	"Brygga Energi",
	"Nordkapp Logistikk",
	"Isbre Health",
] as const;

const FIRST_ORG_NUMBER = 912_000_000;
const SEEDED_YEARS = 5;
const EVENTS_PER_SEMESTER = { min: 9, max: 15 };
const LISTINGS_PER_SEMESTER = { min: 4, max: 12 };
const PARTICIPATION_LIMITS = [15, 25, 30, 40, 40, 40, 60, 80, 120];
const EXTERNAL_EVENT_SHARE = 0.15;
const UNTAGGED_WEIGHT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

async function productsNamed(ctx: MutationCtx, names: readonly string[]) {
	const products: Doc<"products">[] = [];
	for (const name of names) {
		const product = await ctx.db
			.query("products")
			.withIndex("by_name", (q) => q.eq("name", name))
			.unique();
		if (product) products.push(product);
	}
	return products;
}

function seededRandom(seed: number) {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function logoSvg(name: string, hue: number) {
	const initials = name
		.split(" ")
		.map((word) => word[0])
		.join("")
		.slice(0, 2);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" rx="16" fill="hsl(${hue} 55% 42%)"/><text x="120" y="76" font-family="sans-serif" font-size="48" font-weight="700" fill="white" text-anchor="middle">${initials}</text></svg>`;
}

function requireLocal() {
	if (!isLocalDevelopment()) throw new ConvexError("Lokale testdata kan bare lages lokalt.");
}

type SeededCounts = { companies: number; events: number; listings: number };

export const seedLocalSales = internalAction({
	handler: async (ctx): Promise<SeededCounts> => {
		requireLocal();
		const logoIds: Id<"_storage">[] = [];
		for (const [index, name] of COMPANY_NAMES.entries()) {
			const hue = Math.round((index * 360) / COMPANY_NAMES.length);
			logoIds.push(
				await ctx.storage.store(new Blob([logoSvg(name, hue)], { type: "image/svg+xml" })),
			);
		}
		await ctx.runMutation(internal.products.seed.seedProducts, {});
		return await ctx.runMutation(internal.products.localSeed.insertLocalSales, { logoIds });
	},
});

export const insertLocalSales = internalMutation({
	args: { logoIds: v.array(v.id("_storage")) },
	handler: async (ctx, { logoIds }): Promise<SeededCounts> => {
		requireLocal();
		const alreadySeeded = await ctx.db
			.query("companies")
			.withIndex("by_orgNumber", (q) => q.eq("orgNumber", FIRST_ORG_NUMBER))
			.first();
		if (alreadySeeded) return { companies: 0, events: 0, listings: 0 };

		const random = seededRandom(2026);
		const between = ({ min, max }: { min: number; max: number }) =>
			min + Math.floor(random() * (max - min + 1));
		const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)] as T;

		const handTaggedProducts = [
			...(await productsNamed(ctx, [
				SEED_PRODUCT_NAMES.academicEvent,
				SEED_PRODUCT_NAMES.socialEvent,
			])),
			...Array.from({ length: UNTAGGED_WEIGHT }, () => undefined),
		];

		const companyIds: Id<"companies">[] = [];
		for (const [index, name] of COMPANY_NAMES.entries()) {
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

		const now = Date.now();
		const currentYear = new Date(now).getFullYear();
		let events = 0;
		let listings = 0;
		for (let year = currentYear - SEEDED_YEARS + 1; year <= currentYear; year++) {
			for (const semester of ["vår", "høst"] as const) {
				const { start, end } = eventSemesterRange(semester, year);
				if (start > now) continue;
				const lastDay = Math.min(end, now) - DAY_MS;
				const randomDay = () =>
					start + Math.floor(random() * ((lastDay - start) / DAY_MS)) * DAY_MS;

				const eventCount = between(EVENTS_PER_SEMESTER);
				for (let index = 0; index < eventCount; index++) {
					const eventStart = randomDay() + 17 * 60 * 60 * 1000;
					const company = pick(COMPANY_NAMES);
					const externalEvent = random() < EXTERNAL_EVENT_SHARE;
					const handTagged = externalEvent ? undefined : pick(handTaggedProducts);
					await ctx.db.insert("events", {
						title: `${externalEvent ? "Eksternt arrangement" : "Bedriftspresentasjon"} med ${company}`,
						teaser: `Bli kjent med ${company}.`,
						description: `Lokale testdata for ${company}.`,
						eventStart,
						registrationOpens: eventStart - 14 * DAY_MS,
						participationLimit: pick(PARTICIPATION_LIMITS),
						location: externalEvent ? "Hos bedriften" : "Store auditorium, IFI",
						food: "Pizza",
						language: "Norsk",
						ageRestriction: "Ingen",
						externalEvent,
						hostingCompany: companyIds[COMPANY_NAMES.indexOf(company)] as Id<"companies">,
						published: true,
						...(handTagged && { product: snapshotOf(handTagged) }),
					});
					events++;
				}

				const listingCount = between(LISTINGS_PER_SEMESTER);
				for (let index = 0; index < listingCount; index++) {
					const company = pick(COMPANY_NAMES);
					await ctx.db.insert("jobListings", {
						title: `Sommerjobb hos ${company}`,
						type: pick(["Sommerjobb", "Fulltid", "Deltid"]),
						teaser: `${company} ser etter nye utviklere.`,
						description: `Lokale testdata for ${company}.`,
						applicationUrl: "https://example.com/soknad",
						published: true,
						company: companyIds[COMPANY_NAMES.indexOf(company)] as Id<"companies">,
						deadline: randomDay(),
					});
					listings++;
				}
			}
		}

		return { companies: companyIds.length, events, listings };
	},
});
