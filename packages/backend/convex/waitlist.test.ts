/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { updateWaitlist } from "./events/mutations";
import schema from "./schema";

// convex-test resolves function paths relative to this glob, so the test file
// has to sit in the convex root.
const modules = import.meta.glob("./**/*.*s");

const HOUR = 60 * 60 * 1000;

type EventOverrides = Partial<Doc<"events">>;

/**
 * Boots a convex-test instance with a company to hang events off.
 */
function setup() {
	const t = convexTest(schema, modules);

	const companyId = t.run(async (ctx) => {
		const storageId = await ctx.storage.store(new Blob(["logo"]));
		const logo = await ctx.db.insert("companyLogos", { name: "logo", image: storageId });
		return ctx.db.insert("companies", {
			orgNumber: 123456789,
			name: "Testbedrift",
			description: "",
			mainSponsor: false,
			logo,
		});
	});

	return { t, companyId };
}

/**
 * Inserts an event that `checkPendingRegistrations` considers eligible by default:
 * published, no external url, registration already open and start time in the future.
 */
async function insertEvent(
	t: ReturnType<typeof convexTest>,
	companyId: Promise<Id<"companies">>,
	overrides: EventOverrides = {},
) {
	const hostingCompany = await companyId;
	return t.run(async (ctx) =>
		ctx.db.insert("events", {
			title: "Testarrangement",
			teaser: "",
			description: "",
			eventStart: Date.now() + 24 * HOUR,
			registrationOpens: Date.now() - 24 * HOUR,
			participationLimit: 10,
			location: "Ole-Johan Dahls hus",
			food: "",
			language: "norsk",
			ageRestriction: "",
			externalUrl: "",
			hostingCompany,
			published: true,
			...overrides,
		}),
	);
}

async function insertUser(t: ReturnType<typeof convexTest>, email: string) {
	return t.run(async (ctx) =>
		ctx.db.insert("users", {
			email,
			firstName: "Test",
			lastName: "Testesen",
			image: "",
			externalId: email,
			locked: false,
		}),
	);
}

async function insertRegistration(
	t: ReturnType<typeof convexTest>,
	eventId: Id<"events">,
	userId: Id<"users">,
	status: Doc<"registrations">["status"],
	registrationTime: number,
) {
	return t.run(async (ctx) =>
		ctx.db.insert("registrations", { eventId, userId, status, registrationTime }),
	);
}

/**
 * Inserts `count` waitlisted registrations, oldest first, one second apart.
 */
async function insertWaitlist(
	t: ReturnType<typeof convexTest>,
	eventId: Id<"events">,
	count: number,
	startTime = Date.now() - 10 * HOUR,
) {
	const ids: Id<"registrations">[] = [];
	for (let i = 0; i < count; i++) {
		const userId = await insertUser(t, `waitlist-${eventId}-${i}@example.com`);
		ids.push(await insertRegistration(t, eventId, userId, "waitlist", startTime + i * 1000));
	}
	return ids;
}

async function statusOf(t: ReturnType<typeof convexTest>, id: Id<"registrations">) {
	return t.run(async (ctx) => (await ctx.db.get(id))?.status ?? null);
}

async function isDeleted(t: ReturnType<typeof convexTest>, id: Id<"registrations">) {
	return t.run(async (ctx) => (await ctx.db.get(id)) === null);
}

/**
 * The seat emails are `"use node"` actions, so the tests assert on what was
 * scheduled rather than running the scheduler.
 */
async function scheduledSeatEmails(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
		return scheduled.filter((fn) => fn.name.includes("sendAvailableSeatEmail"));
	});
}

async function scheduledFreeForAllEmails(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
		return scheduled.filter((fn) => fn.name.includes("sendFreeForAll"));
	});
}

describe("updateWaitlist", () => {
	it("promoterer de eldste på ventelista og lar resten stå", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const [first, second, third] = await insertWaitlist(t, eventId, 3);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 2));

		expect(await statusOf(t, first)).toBe("pending");
		expect(await statusOf(t, second)).toBe("pending");
		expect(await statusOf(t, third)).toBe("waitlist");
	});

	it("planlegger én seteepost per forfremmet registrering", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		await insertWaitlist(t, eventId, 3);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 2));

		expect(await scheduledSeatEmails(t)).toHaveLength(2);
	});

	it("setter registrationTime på nytt når statusen blir pending", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const oldTime = Date.now() - 10 * HOUR;
		const [only] = await insertWaitlist(t, eventId, 1, oldTime);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 1));

		const registration = await t.run(async (ctx) => ctx.db.get(only));
		expect(registration?.registrationTime).toBeGreaterThan(oldTime);
	});

	it("promoterer hele ventelista når det er flere plasser enn folk", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const ids = await insertWaitlist(t, eventId, 2);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 5));

		for (const id of ids) {
			expect(await statusOf(t, id)).toBe("pending");
		}
	});

	it("gjør ingenting når det ikke er noen nye plasser", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const [only] = await insertWaitlist(t, eventId, 1);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 0));

		expect(await statusOf(t, only)).toBe("waitlist");
		expect(await scheduledSeatEmails(t)).toHaveLength(0);
	});

	it("rører ikke registrerte eller pending registreringer", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const registeredUser = await insertUser(t, "registrert@example.com");
		const registered = await insertRegistration(
			t,
			eventId,
			registeredUser,
			"registered",
			Date.now() - 20 * HOUR,
		);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 3));

		expect(await statusOf(t, registered)).toBe("registered");
		expect(await scheduledSeatEmails(t)).toHaveLength(0);
	});

	it("rører ikke ventelista til andre arrangementer", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const otherEventId = await insertEvent(t, companyId, { title: "Annet arrangement" });
		const [mine] = await insertWaitlist(t, eventId, 1);
		const [theirs] = await insertWaitlist(t, otherEventId, 1);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 5));

		expect(await statusOf(t, mine)).toBe("pending");
		expect(await statusOf(t, theirs)).toBe("waitlist");
	});

	it("kaster når arrangementet ikke finnes", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		await t.run(async (ctx) => ctx.db.delete(eventId));

		await expect(t.run(async (ctx) => updateWaitlist(ctx, eventId, 1))).rejects.toThrow();
	});

	// Bug: `slice(0, numOfNewPlaces)` er ikke klampet. Et negativt tall betyr
	// «alle unntatt de N siste», så nesten hele ventelista blir forfremmet.
	it.fails("forfremmer ingen når antall nye plasser er negativt", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const ids = await insertWaitlist(t, eventId, 3);

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, -1));

		for (const id of ids) {
			expect(await statusOf(t, id)).toBe("waitlist");
		}
	});

	// Bug: `makeStatusPending` kaster når brukeren er slettet, og kallet skjer inne
	// i en `Promise.all`. Feilen ruller tilbake hele mutasjonen, så én slettet
	// bruker blokkerer alle de andre på ventelista.
	it.fails("forfremmer de gyldige selv om én bruker er slettet", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const [first, second] = await insertWaitlist(t, eventId, 2);
		await t.run(async (ctx) => {
			const registration = await ctx.db.get(first);
			if (registration) await ctx.db.delete(registration.userId);
		});

		await t.run(async (ctx) => updateWaitlist(ctx, eventId, 2));

		expect(await statusOf(t, second)).toBe("pending");
	});
});

describe("checkPendingRegistrations", () => {
	it("lar pending registreringer som ikke har gått ut være i fred", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const userId = await insertUser(t, "fersk@example.com");
		const pending = await insertRegistration(t, eventId, userId, "pending", Date.now() - 2 * HOUR);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		expect(await statusOf(t, pending)).toBe("pending");
	});

	it("degraderer utgåtte pending registreringer og tilbyr plassen videre", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const userId = await insertUser(t, "utgatt@example.com");
		const expired = await insertRegistration(t, eventId, userId, "pending", Date.now() - 20 * HOUR);
		const [next] = await insertWaitlist(t, eventId, 1);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expired)).toBe("waitlist");
		expect(await statusOf(t, next)).toBe("pending");
	});

	// Bug: den utgåtte registreringen degraderes til ventelista før koden leter
	// etter neste kandidat, så den er selv den første på ventelista og får plassen
	// tilbake med en gang. Svarfristen på 16 timer får dermed ingen konsekvens.
	it.fails("degraderer utgåtte registreringer selv når ventelista er tom", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		const userId = await insertUser(t, "alene@example.com");
		const expired = await insertRegistration(t, eventId, userId, "pending", Date.now() - 20 * HOUR);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expired)).toBe("waitlist");
		expect(await scheduledSeatEmails(t)).toHaveLength(0);
	});

	it("hopper over upubliserte arrangementer", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { published: false });
		const userId = await insertUser(t, "upublisert@example.com");
		const expired = await insertRegistration(t, eventId, userId, "pending", Date.now() - 20 * HOUR);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expired)).toBe("pending");
	});

	it("hopper over arrangementer med ekstern påmelding", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { externalUrl: "https://example.com" });
		const userId = await insertUser(t, "ekstern@example.com");
		const expired = await insertRegistration(t, eventId, userId, "pending", Date.now() - 20 * HOUR);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		expect(await statusOf(t, expired)).toBe("pending");
	});

	// Bug: de utgåtte registreringene behandles i en `Promise.all`, og hver av dem
	// leser ventelista på nytt før noen av dem er degradert. To frigjorte plasser
	// kan derfor havne hos samme person, eller hos noen som nettopp ble degradert.
	it.fails("gir hver frigjorte plass til sin egen person på ventelista", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		for (const email of ["utgatt-1@example.com", "utgatt-2@example.com"]) {
			const userId = await insertUser(t, email);
			await insertRegistration(t, eventId, userId, "pending", Date.now() - 20 * HOUR);
		}
		const waitlisted = await insertWaitlist(t, eventId, 2);

		await t.mutation(internal.events.waitlist.mutations.checkPendingRegistrations, {});

		for (const id of waitlisted) {
			expect(await statusOf(t, id)).toBe("pending");
		}
	});
});

describe("clearWaitlistAndPending", () => {
	it("sletter venteliste og pending for dagens arrangementer og varsler dem", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR });
		const [waitlisted] = await insertWaitlist(t, eventId, 1);
		const pendingUser = await insertUser(t, "pending@example.com");
		const pending = await insertRegistration(t, eventId, pendingUser, "pending", Date.now());

		await t.mutation(internal.events.waitlist.mutations.clearWaitlistAndPending, {});

		expect(await isDeleted(t, waitlisted)).toBe(true);
		expect(await isDeleted(t, pending)).toBe(true);
		expect(await scheduledFreeForAllEmails(t)).toHaveLength(2);
	});

	it("beholder registrerte deltakere", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR });
		const userId = await insertUser(t, "registrert@example.com");
		const registered = await insertRegistration(t, eventId, userId, "registered", Date.now());

		await t.mutation(internal.events.waitlist.mutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, registered)).toBe("registered");
	});

	it("rører ikke arrangementer på andre dager", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + 3 * 24 * HOUR });
		const [waitlisted] = await insertWaitlist(t, eventId, 1);

		await t.mutation(internal.events.waitlist.mutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, waitlisted)).toBe("waitlist");
	});

	it("gjør ingenting når arrangementet allerede er fullt", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, {
			eventStart: Date.now() + HOUR,
			participationLimit: 1,
		});
		const registeredUser = await insertUser(t, "full@example.com");
		await insertRegistration(t, eventId, registeredUser, "registered", Date.now());
		const [waitlisted] = await insertWaitlist(t, eventId, 1);

		await t.mutation(internal.events.waitlist.mutations.clearWaitlistAndPending, {});

		expect(await statusOf(t, waitlisted)).toBe("waitlist");
		expect(await scheduledFreeForAllEmails(t)).toHaveLength(0);
	});

	it("sletter registreringen uten å varsle når brukeren er borte", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { eventStart: Date.now() + HOUR });
		const [waitlisted] = await insertWaitlist(t, eventId, 1);
		await t.run(async (ctx) => {
			const registration = await ctx.db.get(waitlisted);
			if (registration) await ctx.db.delete(registration.userId);
		});

		await t.mutation(internal.events.waitlist.mutations.clearWaitlistAndPending, {});

		expect(await isDeleted(t, waitlisted)).toBe(true);
		expect(await scheduledFreeForAllEmails(t)).toHaveLength(0);
	});
});

describe("fixWaitlist", () => {
	it("melder fra når arrangementet ikke finnes", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId);
		await t.run(async (ctx) => ctx.db.delete(eventId));

		const result = await t.mutation(internal.events.waitlist.mutations.fixWaitlist, {
			eventId,
		});

		expect(result).toBe("No event found");
	});

	it("fyller ledige plasser fra ventelista", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 2 });
		const registeredUser = await insertUser(t, "har-plass@example.com");
		await insertRegistration(t, eventId, registeredUser, "registered", Date.now());
		const [first, second] = await insertWaitlist(t, eventId, 2);

		await t.mutation(internal.events.waitlist.mutations.fixWaitlist, { eventId });

		expect(await statusOf(t, first)).toBe("pending");
		expect(await statusOf(t, second)).toBe("waitlist");
	});

	it("gjør ingenting når arrangementet allerede er fullt", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const registeredUser = await insertUser(t, "full@example.com");
		await insertRegistration(t, eventId, registeredUser, "registered", Date.now());
		const [waitlisted] = await insertWaitlist(t, eventId, 1);

		await t.mutation(internal.events.waitlist.mutations.fixWaitlist, { eventId });

		expect(await statusOf(t, waitlisted)).toBe("waitlist");
		expect(await scheduledSeatEmails(t)).toHaveLength(0);
	});

	it("teller pending som opptatte plasser", async () => {
		const { t, companyId } = setup();
		const eventId = await insertEvent(t, companyId, { participationLimit: 1 });
		const pendingUser = await insertUser(t, "venter@example.com");
		await insertRegistration(t, eventId, pendingUser, "pending", Date.now());
		const [waitlisted] = await insertWaitlist(t, eventId, 1);

		await t.mutation(internal.events.waitlist.mutations.fixWaitlist, { eventId });

		expect(await statusOf(t, waitlisted)).toBe("waitlist");
	});
});
