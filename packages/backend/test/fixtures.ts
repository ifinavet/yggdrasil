/// <reference types="vite/client" />

import batchWorkerTest from "@convex-dev/batch-worker/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import resendTest from "@convex-dev/resend/test";
import workflowTest from "@convex-dev/workflow/test";
import workpoolTest from "@convex-dev/workpool/test";
import type { WithoutSystemFields } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { AccessRole } from "../convex/auth/accessRights";
import schema from "../convex/schema";
import { CONSENT_VERSION, FORM_VERSION } from "../convex/semesterPlanning/rules";

const convexModules = {
	...import.meta.glob(["../convex/**/*.*s", "!../convex/**/*.test.ts"]),
	"../convex/emails.ts": () => import("./deliveredNothingEmails"),
};

export const HOUR_IN_MS = 60 * 60 * 1000;
export const DAY_IN_MS = 24 * HOUR_IN_MS;

export type TestBackend = ReturnType<typeof convexTest<(typeof schema)["tables"]>>;

export type TestUser = { _id: Id<"users">; externalId: string };

export type EventOverrides = Partial<WithoutSystemFields<Doc<"events">>>;

// Resolve component modules before Workflow disables process during replay. Vitest's
// dynamic-import resolver needs process.platform, unlike Convex's module loader.
const workflowModules = Promise.all(
	[workflowTest.modules, workpoolTest.modules, batchWorkerTest.modules].map(async (modules) =>
		Object.fromEntries(
			await Promise.all(
				Object.entries(modules)
					.filter(([path]) => !path.endsWith(".test.ts") && !path.endsWith("convex.config.ts"))
					.map(async ([path, load]) => {
						const loaded = await load();
						return [path, () => Promise.resolve(loaded)];
					}),
			),
		),
	),
);

export async function setup() {
	const t = convexTest(schema, convexModules);
	rateLimiter.register(t);
	const [workflow, workpool, batchWorker] = await workflowModules;
	t.registerComponent("workflow", workflowTest.schema, workflow);
	t.registerComponent("workflow/workpool", workpoolTest.schema, workpool);
	t.registerComponent("workflow/workpool/batchWorker", batchWorkerTest.schema, batchWorker);
	resendTest.register(t, "feedbackResend");
	resendTest.register(t, "resend");

	const companyId = await t.run(async (ctx) => {
		const image = await ctx.storage.store(new Blob(["logo"]));
		const logo = await ctx.db.insert("companyLogos", { name: "logo", image });
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

export async function insertEvent(
	t: TestBackend,
	companyId: Id<"companies">,
	overrides: EventOverrides = {},
): Promise<Id<"events">> {
	return t.run((ctx) =>
		ctx.db.insert("events", {
			title: "Testarrangement",
			teaser: "",
			description: "",
			eventStart: Date.now() + 2 * DAY_IN_MS,
			registrationOpens: Date.now() - DAY_IN_MS,
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

export async function setupEventWithOneOfEachStatus(overrides: EventOverrides = {}) {
	const { t, companyId } = await setup();
	const now = Date.now();
	const eventId = await insertEvent(t, companyId, overrides);

	const seated = await insertUser(t, "sitter@example.com");
	await insertRegistration(t, eventId, seated._id, "registered", now);
	const offered = await insertUser(t, "tilbudt@example.com");
	await insertRegistration(t, eventId, offered._id, "pending", now + 1);
	const waiting = await insertUser(t, "venter@example.com");
	await insertRegistration(t, eventId, waiting._id, "waitlist", now + 2);

	return { t, companyId, eventId, seated, offered, waiting };
}

export async function registrationById(
	t: TestBackend,
	registrationId: Id<"registrations">,
): Promise<Doc<"registrations"> | null> {
	return t.run((ctx) => ctx.db.get(registrationId));
}

export async function statusOf(
	t: TestBackend,
	registrationId: Id<"registrations">,
): Promise<Doc<"registrations">["status"] | null> {
	return (await registrationById(t, registrationId))?.status ?? null;
}

export async function registrationsForEvent(
	t: TestBackend,
	eventId: Id<"events">,
): Promise<Doc<"registrations">[]> {
	return t.run((ctx) =>
		ctx.db
			.query("registrations")
			.withIndex("by_eventId", (q) => q.eq("eventId", eventId))
			.collect(),
	);
}

export async function countRegistrationsForEvent(
	t: TestBackend,
	eventId: Id<"events">,
): Promise<number> {
	return (await registrationsForEvent(t, eventId)).length;
}

export async function emailsWithStatus(
	t: TestBackend,
	eventId: Id<"events">,
	status: Doc<"registrations">["status"],
): Promise<string[]> {
	const emails = await t.run(async (ctx) => {
		const matching = await ctx.db
			.query("registrations")
			.withIndex("by_eventIdStatusAndRegistrationTime", (q) =>
				q.eq("eventId", eventId).eq("status", status),
			)
			.collect();

		return Promise.all(
			matching.map(async (registration) => {
				const user = await ctx.db.get(registration.userId);
				return user?.email ?? "ukjent";
			}),
		);
	});

	return emails.sort();
}

export async function pointsFor(
	t: TestBackend,
	studentId: Id<"students">,
): Promise<Doc<"points">[]> {
	return t.run((ctx) =>
		ctx.db
			.query("points")
			.withIndex("by_studentId", (q) => q.eq("studentId", studentId))
			.collect(),
	);
}

export async function totalPointsFor(t: TestBackend, studentId: Id<"students">): Promise<number> {
	const points = await pointsFor(t, studentId);
	return points.reduce((total, point) => total + point.severity, 0);
}

export async function scheduledRecipientsOf(
	t: TestBackend,
	emailFunctionName: string,
): Promise<string[]> {
	return t.run(async (ctx) => {
		const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
		return scheduled
			.filter((job) => job.name.endsWith(emailFunctionName))
			.map((job) => (job.args[0] as { participantEmail: string }).participantEmail);
	});
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

export type SemesterOverrides = Partial<WithoutSystemFields<Doc<"semesters">>>;
export type ApplicationOverrides = Partial<WithoutSystemFields<Doc<"companyApplications">>>;

export async function insertSemester(
	t: TestBackend,
	overrides: SemesterOverrides = {},
): Promise<Id<"semesters">> {
	return t.run((ctx) =>
		ctx.db.insert("semesters", {
			year: 2027,
			term: "spring",
			firstDate: "2027-01-19",
			lastDate: "2027-05-13",
			applicationDeadline: "2026-12-04",
			status: "open",
			...overrides,
		}),
	);
}

export async function insertApplication(
	t: TestBackend,
	semesterId: Id<"semesters">,
	overrides: ApplicationOverrides = {},
): Promise<Id<"companyApplications">> {
	return t.run((ctx) =>
		ctx.db.insert("companyApplications", {
			semesterId,
			formVersion: FORM_VERSION,
			orgNumber: "924773189",
			registry: {
				name: "FJORDKODE AS",
				organizationForm: { code: "AS", description: "Aksjeselskap" },
				fetchedAt: Date.now(),
			},
			contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+4741234567" },
			eventType: "standard_presentation",
			minStudents: 25,
			maxStudents: 40,
			description: "Presentasjon og kodeoppgave.",
			availableDates: ["2027-02-09", "2027-02-16"],
			venue: "campus",
			wantsToUseEscape: "unsure",
			foodAndDrinks: true,
			foodPurchasedBy: "company",
			billing: { email: "faktura@fjordkode.no", details: "Referanse: PO-2027-014" },
			targetDegrees: [],
			targetStudyPrograms: [],
			consent: { version: CONSENT_VERSION, consentedAt: Date.now() },
			status: "applied",
			...overrides,
		}),
	);
}

export async function applicationById(t: TestBackend, applicationId: Id<"companyApplications">) {
	const application = await t.run((ctx) => ctx.db.get(applicationId));
	if (!application) throw new Error("Expected the application to exist.");
	return application;
}

export async function activityFor(t: TestBackend, applicationId: Id<"companyApplications">) {
	return t.run((ctx) =>
		ctx.db
			.query("companyApplicationActivity")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.collect(),
	);
}
