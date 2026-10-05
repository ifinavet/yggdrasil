import { ADMISSION_GROUPS } from "@workspace/shared/admissions";
import { PREVIEW_INTERVIEWER_IMAGES } from "@workspace/shared/admissions/preview";
import { STUDY_PROGRAMS } from "@workspace/shared/constants";
import { localIdentity } from "@workspace/shared/local";
import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";
import { adminRoles, requireRole } from "../auth/accessRights";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { requireLocal } from "../products/localSeed";

const DAY = 24 * 60 * 60 * 1000;
const seedPrefix = "seed-admissions-";

async function localUser(ctx: MutationCtx, ensureStudentProfile = true) {
	const existing = await ctx.db
		.query("users")
		.withIndex("by_ExternalId", (q) => q.eq("externalId", localIdentity.subject))
		.unique();
	const userId =
		existing?._id ??
		(await ctx.db.insert("users", {
			externalId: localIdentity.subject,
			firstName: localIdentity.givenName,
			lastName: localIdentity.familyName,
			email: localIdentity.email,
			image: localIdentity.profileUrl,
			locked: false,
		}));
	const student = await ctx.db
		.query("students")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();
	if (!student && ensureStudentProfile)
		await ctx.db.insert("students", {
			userId,
			name: `${localIdentity.givenName} ${localIdentity.familyName}`,
			studyProgram: "Informatikk: programmering og systemarkitektur",
			year: 1,
			degree: "Bachelor",
		});
	if (student && !ensureStudentProfile) await ctx.db.delete(student._id);
	const rights = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();
	if (!rights) await ctx.db.insert("accessRights", { userId, role: "super-admin" });
	return userId;
}

async function syntheticUser(ctx: MutationCtx, index: number) {
	const externalId = `${seedPrefix}applicant-${index}`;
	const email = `applicant-${index}@uio.no`;
	const firstName = ["Ingrid", "Emma", "Nora", "Jakob", "Emil", "Sara"][index % 6] ?? "Student";
	const lastName = ["Hansen", "Berg", "Dahl", "Olsen", "Lie"][index % 5] ?? "Nordmann";
	const existing = await ctx.db
		.query("users")
		.withIndex("by_ExternalId", (q) => q.eq("externalId", externalId))
		.unique();
	const userId =
		existing?._id ??
		(await ctx.db.insert("users", {
			externalId,
			firstName,
			lastName,
			email,
			image: "",
			locked: false,
		}));
	const student = await ctx.db
		.query("students")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();
	if (!student)
		await ctx.db.insert("students", {
			userId,
			name: `${firstName} ${lastName}`,
			studyProgram: STUDY_PROGRAMS[index % 8] ?? STUDY_PROGRAMS[0],
			year: (index % 5) + 1,
			degree: index % 3 ? "Bachelor" : "Master",
		});
	return { userId, firstName, lastName, email };
}

async function boardUser(ctx: MutationCtx, name: string, email: string, image: string) {
	const [firstName, ...rest] = name.split(" ");
	const lastName = rest.join(" ");
	const externalId = `${seedPrefix}${email.split("@")[0]}`;
	const existing = await ctx.db
		.query("users")
		.withIndex("by_ExternalId", (q) => q.eq("externalId", externalId))
		.unique();
	const userId =
		existing?._id ??
		(await ctx.db.insert("users", {
			externalId,
			firstName: firstName ?? "Styremedlem",
			lastName,
			email,
			image,
			locked: false,
		}));
	if (existing) await ctx.db.patch(userId, { image });
	const internal = await ctx.db
		.query("internals")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();
	if (!internal)
		await ctx.db.insert("internals", { userId, position: "Styremedlem", group: "Styret" });
	const role = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.first();
	if (!role) await ctx.db.insert("accessRights", { userId, role: "internal" });
	return userId;
}

async function clearAdmissions(ctx: MutationCtx) {
	const applicant = await ctx.db
		.query("users")
		.withIndex("by_ExternalId", (q) => q.eq("externalId", localIdentity.subject))
		.unique();
	if (applicant) {
		const seededMembership = await ctx.db
			.query("internals")
			.withIndex("by_userId", (q) => q.eq("userId", applicant._id))
			.first();
		if (seededMembership?.position === "Intern" && seededMembership.group === "Web")
			await ctx.db.delete(seededMembership._id);
	}
	const priorOnboarding = await ctx.db
		.query("memberAccounts")
		.withIndex("by_uioEmail", (q) => q.eq("uioEmail", "developer@uio.no"))
		.unique();
	if (priorOnboarding?.workspaceEmail === "developer@ifinavet.no") {
		await ctx.db.patch(priorOnboarding._id, {
			stage: "cancelled",
			google: "suspended",
			updatedAt: Date.now(),
		});
	}
	const deliveries = await ctx.db.query("admissionDeliveries").take(1000);
	await Promise.all(deliveries.map((item) => ctx.db.delete(item._id)));
	const interviews = await ctx.db.query("admissionInterviews").take(1000);
	await Promise.all(interviews.map((item) => ctx.db.delete(item._id)));
	const applications = await ctx.db.query("admissionApplications").take(1000);
	await Promise.all(applications.map((item) => ctx.db.delete(item._id)));
	const jobs = await ctx.db.query("admissionOutbox").take(1000);
	await Promise.all(jobs.map((item) => ctx.db.delete(item._id)));
	const periods = await ctx.db.query("admissionPeriods").take(10);
	await Promise.all(periods.map((item) => ctx.db.delete(item._id)));
}

function isoDay(at: number) {
	return formatOsloDate(at, "yyyy-MM-dd");
}

function periodTitle(at: number) {
	const month = Number(formatOsloDate(at, "M"));
	return `${month >= 7 ? "Høst" : "Vår"} ${formatOsloDate(at, "yyyy")}`;
}

export const reset = mutation({
	args: {
		scenario: v.union(
			v.literal("empty"),
			v.literal("missing-profile"),
			v.literal("open"),
			v.literal("scheduled"),
			v.literal("delivery-failed"),
			v.literal("decisions"),
			v.literal("offer-pending-accepted"),
			v.literal("offer-pending-declined"),
			v.literal("offer-expired"),
		),
	},
	handler: async (ctx, { scenario }) => {
		requireLocal();
		await requireRole(ctx, adminRoles);
		await clearAdmissions(ctx);
		if (scenario === "empty") return null;
		const now = Date.now();
		const applicantId = await localUser(ctx, scenario !== "missing-profile");
		const secondId = await boardUser(
			ctx,
			"Kristin Berg",
			"kristin.berg@ifinavet.no",
			PREVIEW_INTERVIEWER_IMAGES[0] ?? "",
		);
		const thirdId = await boardUser(
			ctx,
			"Daniel Holm",
			"daniel.holm@ifinavet.no",
			PREVIEW_INTERVIEWER_IMAGES[1] ?? "",
		);
		await boardUser(
			ctx,
			"Aksel Nilsen",
			"aksel.nilsen@ifinavet.no",
			PREVIEW_INTERVIEWER_IMAGES[2] ?? "",
		);
		const admin = await getCurrentUserOrThrow(ctx);
		const applicationStartAt = now - DAY;
		const applicationEndAt = now + 7 * DAY;
		const interviewStartAt = now + 8 * DAY;
		const interviewEndAt = now + 15 * DAY;
		const retentionAt = interviewEndAt + 45 * DAY;
		const periodId = await ctx.db.insert("admissionPeriods", {
			title: periodTitle(now),
			applicationStartAt,
			applicationEndAt,
			interviewStartAt,
			interviewEndAt,
			retentionAt,
			status: "open",
			revision: 1,
			interviewers: [
				{ userId: secondId, selectedCalendarIds: ["navet", "timetable"] },
				{ userId: thirdId, selectedCalendarIds: ["navet", "timetable"] },
			],
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
			round: 0,
			roundHistory: [],
			createdBy: admin._id,
			updatedBy: admin._id,
		});
		await ctx.scheduler.runAt(retentionAt, internal.admissions.internal.closeExpiredPeriod, {
			periodId,
		});
		if (scenario === "missing-profile") return { periodId, applicantId, candidateCount: 0 };
		const ownDay = isoDay(interviewStartAt + 2 * DAY);
		await ctx.db.patch(applicantId, { email: "developer@uio.no" });
		const ownStatus = scenario === "open" ? "draft" : "submitted";
		const ownDecision =
			scenario === "decisions" ||
			scenario === "offer-pending-accepted" ||
			scenario === "offer-pending-declined" ||
			scenario === "offer-expired"
				? "accepted"
				: "pending";
		const ownOffer: Doc<"admissionApplications">["offerStatus"] = offerScenario(scenario);
		let offerDeadline: number | undefined;
		if (ownOffer === "pending") {
			offerDeadline = now + 3 * DAY;
			if (scenario === "offer-expired") offerDeadline = now - DAY;
		}
		const ownId = await ctx.db.insert("admissionApplications", {
			periodId,
			userId: applicantId,
			studentProfile: {
				name: `${localIdentity.givenName} ${localIdentity.familyName}`,
				studyProgram: "Informatikk: programmering og systemarkitektur",
				year: 1,
				degree: "Bachelor",
			},
			about: "Jeg liker å bygge ting sammen med andre studenter.",
			motivation: "Jeg vil bidra i et godt fagmiljø og lære mer.",
			group: "Usikker ennå",
			availability: [{ day: ownDay, start: 540, end: 960 }],
			consentedAt: now - 60_000,
			consentVersion: "admissions-2026-01",
			status: ownStatus,
			revision: 2,
			decisionRevision: ownDecision === "accepted" ? 1 : 0,
			decision: ownDecision,
			reviewedGroup: ownDecision === "accepted" ? "Web" : undefined,
			reviewedWorkspaceEmail: ownDecision === "accepted" ? "developer@ifinavet.no" : undefined,
			notes: "Local demo note.",
			decisionBy: ownDecision === "accepted" ? admin._id : undefined,
			decisionAt: ownDecision === "accepted" ? now - 60_000 : undefined,
			decisionSentAt: ownOffer !== "none" ? now - 30_000 : undefined,
			decisionQueuedAt: undefined,
			offerStatus: ownOffer,
			offerDeadline,
			offerRespondedAt: ownOffer === "declined" ? now - 10_000 : undefined,
			sent: ownOffer !== "none",
		});
		if (scenario === "scheduled" || scenario === "delivery-failed" || ownOffer !== "none") {
			await seedPublishedInterview(
				ctx,
				periodId,
				ownId,
				ownDay,
				[secondId, thirdId],
				scenario === "delivery-failed",
				now,
			);
		}
		await seedOtherCandidates(ctx, periodId, interviewStartAt, scenario === "decisions", now);
		return { periodId, applicantId, candidateCount: 31 };
	},
});

async function seedPublishedInterview(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
	applicationId: Id<"admissionApplications">,
	day: string,
	interviewerIds: Id<"users">[],
	failedDelivery: boolean,
	now: number,
) {
	const startAt = osloDateTimeToEpoch(day, "10:00");
	const interviewId = await ctx.db.insert("admissionInterviews", {
		periodId,
		applicationId,
		startAt,
		endAt: startAt + 15 * 60_000,
		interviewerIds,
		selectedCalendarIds: ["navet", "timetable"],
		room: "Beta",
		status: "scheduled",
		revision: 1,
		calendarEventId: `local:${applicationId}`,
		publishedAt: now - 30_000,
	});
	if (!failedDelivery) return;
	await Promise.all(
		(["remind_3d", "remind_1d"] as const).map((kind) =>
			ctx.db.insert("admissionOutbox", {
				periodId,
				applicationId,
				interviewId,
				kind,
				revision: 1,
				idempotencyKey: `local-failed-${kind}-${interviewId}`,
				state: "failed",
				attempts: 8,
				nextAttemptAt: now,
				createdAt: now,
				lastError: "E-posttjenesten svarte ikke. Prøv igjen eller følg opp manuelt.",
			}),
		),
	);
}

async function seedOtherCandidates(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
	interviewStartAt: number,
	decisions: boolean,
	now: number,
) {
	await Promise.all(
		Array.from({ length: 30 }, async (_, index) => {
			const person = await syntheticUser(ctx, index);
			const day = isoDay(interviewStartAt + ((index % 5) + 1) * DAY);
			const decision: Doc<"admissionApplications">["decision"] = decisions
				? ((["shortlist", "rejected", "pending"] as const)[index % 3] ?? "pending")
				: "pending";
			await ctx.db.insert("admissionApplications", {
				periodId,
				userId: person.userId,
				studentProfile: {
					name: `${person.firstName} ${person.lastName}`,
					studyProgram: STUDY_PROGRAMS[index % 8] ?? STUDY_PROGRAMS[0],
					year: (index % 5) + 1,
					degree: "Bachelor",
				},
				about: `${person.firstName} liker å lage digitale løsninger.`,
				motivation: "Jeg vil bli kjent med flere i Navet.",
				group: ADMISSION_GROUPS[index % (ADMISSION_GROUPS.length - 1)] ?? "Web",
				availability: index % 7 === 0 ? [] : [{ day, start: 540, end: 960 }],
				consentedAt: now - 60_000,
				consentVersion: "admissions-2026-01",
				status: "submitted",
				revision: 1,
				decisionRevision: decision === "pending" ? 0 : 1,
				decision,
				sent: false,
				offerStatus: "none",
			});
		}),
	);
}

function offerScenario(scenario: string): Doc<"admissionApplications">["offerStatus"] {
	if (scenario === "offer-pending-declined") return "declined";
	return scenario === "decisions" ||
		scenario === "offer-pending-accepted" ||
		scenario === "offer-expired"
		? "pending"
		: "none";
}
