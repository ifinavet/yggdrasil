/// <reference types="vite/client" />
import type { WithoutSystemFields } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { AccessRole } from "../convex/auth/accessRights";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.*s");

const HOUR_IN_MS = 60 * 60 * 1000;

export type TestBackend = ReturnType<typeof convexTest<(typeof schema)["tables"]>>;

export type TestUser = { _id: Id<"users">; externalId: string };

export async function setup() {
	const t = convexTest(schema, modules);

	const { companyId, logoId } = await t.run(async (ctx) => {
		const image = await ctx.storage.store(new Blob(["logo"]));
		const logo = await ctx.db.insert("companyLogos", { name: "logo", image });
		const company = await ctx.db.insert("companies", {
			orgNumber: 123456789,
			name: "Testbedrift",
			description: "",
			mainSponsor: false,
			logo,
		});
		return { companyId: company, logoId: logo };
	});

	return { t, companyId, logoId };
}

export async function insertUser(
	t: TestBackend,
	email: string,
	overrides: Partial<WithoutSystemFields<Doc<"users">>> = {},
): Promise<TestUser> {
	const fields = {
		email,
		firstName: "Test",
		lastName: "Testesen",
		image: "",
		externalId: email,
		locked: false,
		...overrides,
	};

	const userId = await t.run((ctx) => ctx.db.insert("users", fields));

	return { _id: userId, externalId: fields.externalId };
}

export async function insertStudent(
	t: TestBackend,
	userId: Id<"users">,
	overrides: Partial<WithoutSystemFields<Doc<"students">>> = {},
): Promise<Id<"students">> {
	return t.run((ctx) =>
		ctx.db.insert("students", {
			userId,
			name: "Test Testesen",
			studyProgram: "Informatikk",
			year: 2,
			degree: "Bachelor" as const,
			...overrides,
		}),
	);
}

export async function givePointsTo(
	t: TestBackend,
	studentId: Id<"students">,
	severity: number,
): Promise<Id<"points">> {
	return t.run((ctx) => ctx.db.insert("points", { studentId, severity, reason: "Testprikk" }));
}

export async function grantRole(
	t: TestBackend,
	userId: Id<"users">,
	role: AccessRole,
): Promise<Id<"accessRights">> {
	return t.run((ctx) => ctx.db.insert("accessRights", { userId, role }));
}

export async function insertInternal(
	t: TestBackend,
	userId: Id<"users">,
	position = "Intern",
): Promise<Id<"internals">> {
	return t.run((ctx) => ctx.db.insert("internals", { userId, position, group: "Testgruppe" }));
}

export async function insertEvent(
	t: TestBackend,
	companyId: Id<"companies">,
	overrides: Partial<WithoutSystemFields<Doc<"events">>> = {},
): Promise<Id<"events">> {
	return t.run((ctx) =>
		ctx.db.insert("events", {
			title: "Testarrangement",
			teaser: "",
			description: "",
			eventStart: Date.now() + 48 * HOUR_IN_MS,
			registrationOpens: Date.now() - 24 * HOUR_IN_MS,
			participationLimit: 10,
			location: "Ole-Johan Dahls hus",
			food: "",
			language: "norsk",
			ageRestriction: "",
			externalEvent: false,
			externalUrl: "",
			hostingCompany: companyId,
			published: true,
			...overrides,
		}),
	);
}

export async function insertRegistration(
	t: TestBackend,
	eventId: Id<"events">,
	userId: Id<"users">,
	status: Doc<"registrations">["status"],
	registrationTime = Date.now(),
): Promise<Id<"registrations">> {
	return t.run((ctx) =>
		ctx.db.insert("registrations", { eventId, userId, status, registrationTime }),
	);
}

export async function insertOrganizer(
	t: TestBackend,
	eventId: Id<"events">,
	userId: Id<"users">,
): Promise<Id<"eventOrganizers">> {
	return t.run((ctx) =>
		ctx.db.insert("eventOrganizers", { eventId, userId, role: "hovedansvarlig" as const }),
	);
}

export function asUser(t: TestBackend, user: TestUser) {
	return t.withIdentity({ subject: user.externalId });
}

export async function refusalMessageFrom(call: Promise<unknown>): Promise<string> {
	try {
		await call;
	} catch (error) {
		if (error instanceof ConvexError) return String(error.data);
		throw error;
	}

	throw new Error("Expected the call to be refused, but it resolved.");
}

export async function roleOf(t: TestBackend, userId: Id<"users">): Promise<AccessRole | null> {
	return t.run(async (ctx) => {
		const rights = await ctx.db
			.query("accessRights")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first();
		return rights?.role ?? null;
	});
}
