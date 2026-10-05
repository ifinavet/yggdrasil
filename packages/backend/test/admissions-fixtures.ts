import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { Operation } from "../convex/admissions/delivery/workflow";
import { firstOperation } from "./admissions-workflow";
import { asUser, grantRole, insertUser, setup, type TestBackend } from "./fixtures";

const DAY = 24 * 60 * 60 * 1000;

export function periodFields(
	userId: Id<"users">,
	overrides: Partial<WithoutSystemFields<Doc<"admissionPeriods">>> = {},
): WithoutSystemFields<Doc<"admissionPeriods">> {
	const now = Date.now();
	return {
		title: "Høst 2026",
		applicationStartAt: now - 1_000,
		applicationEndAt: now + DAY,
		interviewStartAt: now + 2 * DAY,
		interviewEndAt: now + 7 * DAY,
		retentionAt: now + 14 * DAY,
		status: "open",
		revision: 1,
		interviewers: [],
		duration: 15,
		buffer: 5,
		breakEvery: 3,
		breakMinutes: 15,
		lunch: true,
		room: "Beta",
		dayStart: 540,
		dayEnd: 960,
		breaks: [],
		timezone: "Europe/Oslo",
		round: 1,
		roundHistory: [],
		createdBy: userId,
		updatedBy: userId,
		...overrides,
	};
}

export function applicationFields(
	periodId: Id<"admissionPeriods">,
	userId: Id<"users">,
	overrides: Partial<WithoutSystemFields<Doc<"admissionApplications">>> = {},
): WithoutSystemFields<Doc<"admissionApplications">> {
	return {
		periodId,
		userId,
		availability: [],
		status: "submitted",
		revision: 1,
		decisionRevision: 0,
		decision: "pending",
		offerStatus: "none",
		sent: false,
		...overrides,
	};
}

export function interviewFields(
	periodId: Id<"admissionPeriods">,
	applicationId: Id<"admissionApplications">,
	overrides: Partial<WithoutSystemFields<Doc<"admissionInterviews">>> = {},
): WithoutSystemFields<Doc<"admissionInterviews">> {
	const startAt = Date.now() + 2 * DAY;
	return {
		periodId,
		applicationId,
		startAt,
		endAt: startAt + 15 * 60 * 1000,
		interviewerIds: [],
		selectedCalendarIds: [],
		room: "Beta",
		status: "scheduled",
		revision: 1,
		...overrides,
	};
}

export async function insertInternalGroup(t: TestBackend, name = "Bedrift") {
	return await t.run(async (ctx) => {
		const existing = await ctx.db
			.query("internalGroups")
			.withIndex("by_name", (q) => q.eq("name", name))
			.unique();
		return existing?._id ?? (await ctx.db.insert("internalGroups", { name, description: "" }));
	});
}

export function firstAdmissionOperation(
	t: TestBackend,
	periodId: Id<"admissionPeriods">,
	kind: Operation["kind"],
) {
	return t.run((ctx) => firstOperation(ctx, periodId, kind));
}

export function insertInterview(
	t: TestBackend,
	periodId: Id<"admissionPeriods">,
	applicationId: Id<"admissionApplications">,
	overrides: Parameters<typeof interviewFields>[2] = {},
) {
	return t.run((ctx) =>
		ctx.db.insert("admissionInterviews", interviewFields(periodId, applicationId, overrides)),
	);
}

export function interviewForApplication(
	t: TestBackend,
	applicationId: Id<"admissionApplications">,
) {
	return t.run((ctx) =>
		ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.unique(),
	);
}

export async function admissionPeriodFixture(overrides: Parameters<typeof periodFields>[1] = {}) {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const now = Date.now();
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, overrides)),
	);
	return { t, admin, adminClient: asUser(t, admin), periodId, now };
}

export async function admissionApplicationFixture(
	periodOverrides: Parameters<typeof periodFields>[1] = {},
	applicationOverrides: Parameters<typeof applicationFields>[2] = {},
) {
	const value = await admissionPeriodFixture(periodOverrides);
	const applicant = await insertUser(value.t, "applicant@uio.no");
	const applicationId = await value.t.run((ctx) =>
		ctx.db.insert(
			"admissionApplications",
			applicationFields(value.periodId, applicant._id, applicationOverrides),
		),
	);
	return { ...value, applicant, applicantClient: asUser(value.t, applicant), applicationId };
}
