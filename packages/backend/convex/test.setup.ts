import { convexTest } from "convex-test";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

declare global {
	interface ImportMeta {
		glob: (
			pattern: string,
			options?: { query?: string; import?: string; eager?: boolean },
		) => Record<string, unknown>;
	}
}

export const modules = import.meta.glob("./**/*.*s") as Record<string, () => Promise<unknown>>;

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function createHarness() {
	return convexTest(schema, modules);
}

export type Harness = ReturnType<typeof createHarness>;

let nextExternalId = 0;

export async function seedEvent(
	t: Harness,
	participationLimit: number,
	startsInMs = 7 * ONE_DAY_MS,
) {
	return await t.run(async (ctx) => {
		const image = await ctx.storage.store(new Blob(["logo"]));
		const logo = await ctx.db.insert("companyLogos", { name: "logo", image });
		const hostingCompany = await ctx.db.insert("companies", {
			orgNumber: 123456789,
			name: "Testbedrift",
			description: "",
			mainSponsor: false,
			logo,
		});

		return await ctx.db.insert("events", {
			title: "Bedriftspresentasjon",
			teaser: "",
			description: "",
			eventStart: Date.now() + startsInMs,
			registrationOpens: Date.now() - ONE_DAY_MS,
			participationLimit,
			location: "Ole-Johan Dahls hus",
			food: "Pizza",
			language: "Norsk",
			ageRestriction: "Ingen",
			externalEvent: false,
			hostingCompany,
			published: true,
		});
	});
}

export async function seedStudent(t: Harness) {
	nextExternalId += 1;
	const externalId = `student-${nextExternalId}`;

	const userId = await t.run(async (ctx) => {
		const id = await ctx.db.insert("users", {
			email: `${externalId}@uio.no`,
			firstName: "Test",
			lastName: externalId,
			image: "",
			externalId,
			locked: false,
		});

		await ctx.db.insert("students", {
			userId: id,
			name: `Test ${externalId}`,
			studyProgram: "Informatikk",
			year: 2,
			degree: "Bachelor",
		});

		return id;
	});

	return { userId, externalId };
}

export async function seedOrganizer(t: Harness, eventId: Id<"events">) {
	const organizer = await seedStudent(t);

	await t.run(async (ctx) => {
		await ctx.db.insert("eventOrganizers", {
			eventId,
			userId: organizer.userId,
			role: "hovedansvarlig",
		});
	});

	return organizer;
}

export async function seedRegistration(
	t: Harness,
	eventId: Id<"events">,
	status: Doc<"registrations">["status"],
	registrationTime: number,
) {
	const { userId, externalId } = await seedStudent(t);

	const registrationId = await t.run(
		async (ctx) =>
			await ctx.db.insert("registrations", { eventId, userId, status, registrationTime }),
	);

	return { userId, externalId, registrationId };
}
