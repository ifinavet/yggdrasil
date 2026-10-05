import {
	ADMISSION_SCHEDULING_DEFAULTS,
	ADMISSION_UNSURE_GROUP,
	isValidAvailability,
	MIN_INTERVIEW_NOTICE_MS,
	overlapsLunch,
} from "@workspace/shared/admissions";
import { coversWindow, localDateAndMinute, localWindow, overlaps } from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";
import { adminRoles, internalRoles, requireRole, userHasRole } from "../auth/accessRights";
import { getCurrentUserOrThrow } from "../auth/currentUser";
import { startAcceptedAdmissionOnboarding, validateAdmissionOffer } from "../iam/mutations";
import { requireMutablePeriod } from "./access";
import { activePublishInterviewIds, beginClose, queueOutbox } from "./lifecycle";
import {
	MAX_APPLICATIONS,
	MAX_INTERVIEWERS,
	validatePeriodWindow,
	validateSettings,
} from "./rules";
import {
	admissionGroupChoice,
	availabilityWindow,
	decisionValue,
	interviewerSelection,
} from "./schema";

const CONSENT_VERSION = "admissions-2026-01";
const text = (value: string, max: number) => value.trim().length <= max;

async function validateGroupChoice(
	ctx: MutationCtx,
	group: Id<"internalGroups"> | typeof ADMISSION_UNSURE_GROUP,
) {
	if (group !== ADMISSION_UNSURE_GROUP && !(await ctx.db.get(group)))
		throw new ConvexError("Velg en arbeidsgruppe som fortsatt finnes.");
}

function manualInterviewWindow(startAt: number, period: Doc<"admissionPeriods">) {
	if (
		startAt < period.interviewStartAt ||
		startAt + period.duration * 60000 > period.interviewEndAt
	)
		throw new ConvexError("Intervjutiden er utenfor perioden.");
	const window = localWindow(startAt, period.duration, period.timezone);
	const meeting = { ...window, end: window.start + period.duration + period.buffer };
	if (meeting.start < period.dayStart || meeting.end > period.dayEnd)
		throw new ConvexError("Intervjutiden er utenfor arbeidsdagen.");
	if (period.lunch && overlapsLunch(meeting))
		throw new ConvexError("Intervjutiden kolliderer med lunsjpausen.");
	if (period.breaks.some((pause) => overlaps(pause, meeting)))
		throw new ConvexError("Intervjutiden kolliderer med en pause.");
	return meeting;
}

function assertApplicantAvailable(
	app: Doc<"admissionApplications">,
	meeting: ReturnType<typeof manualInterviewWindow>,
	confirmedOutsideForm: boolean | undefined,
) {
	if (
		app.status !== "submitted" ||
		(!coversWindow(app.availability, meeting) && !confirmedOutsideForm)
	)
		throw new ConvexError("Søkeren er ikke tilgjengelig på dette tidspunktet.");
}

async function validatePreviousInterviewEdit(
	ctx: MutationCtx,
	periodId: Id<"admissionPeriods">,
	previous: Doc<"admissionInterviews"> | null,
	desired: {
		startAt: number;
		endAt: number;
		room: string;
		interviewerIds: Id<"users">[];
		calendarIds: string[];
		confirmedOutsideForm?: boolean;
		confirmPublishedReschedule?: boolean;
	},
) {
	if (!previous) {
		assertInterviewNotice(desired.startAt);
		return false;
	}
	if ((await activePublishInterviewIds(ctx, periodId)).has(previous._id))
		throw new ConvexError("Intervjuet publiseres nå. Vent før du endrer planen.");
	if (previous.status === "cancelled" && !desired.confirmedOutsideForm)
		throw new ConvexError("Bekreft at søkeren har avtalt et nytt tidspunkt før du booker på nytt.");
	const sameSchedule =
		previous.startAt === desired.startAt &&
		previous.endAt === desired.endAt &&
		previous.room === desired.room &&
		previous.interviewerIds.length === desired.interviewerIds.length &&
		previous.interviewerIds.every((id) => desired.interviewerIds.includes(id)) &&
		previous.selectedCalendarIds.length === desired.calendarIds.length &&
		previous.selectedCalendarIds.every((id) => desired.calendarIds.includes(id));
	if (!sameSchedule || !previous.publishedAt) assertInterviewNotice(desired.startAt);
	if (previous.publishedAt && !sameSchedule && !desired.confirmPublishedReschedule)
		throw new ConvexError("Bekreft endring av det publiserte intervjuet før du lagrer.");
	return sameSchedule;
}

async function cancelScheduledInterview(
	ctx: MutationCtx,
	app: Doc<"admissionApplications">,
	period: Doc<"admissionPeriods">,
	interview: Doc<"admissionInterviews">,
	idempotencyKey: string,
	notifyApplicant: boolean,
) {
	const now = Date.now();
	const revision = interview.revision + 1;
	const refillEligible = interview.startAt - now >= 48 * 60 * 60 * 1000;
	await ctx.db.patch(interview._id, { status: "cancelled", revision, publishedAt: undefined });
	await ctx.db.patch(app._id, { revision: app.revision + 1 });
	await queueOutbox(ctx, {
		kind: "cancel_interview",
		periodId: period._id,
		applicationId: app._id,
		interviewId: interview._id,
		revision,
		idempotencyKey,
		nextAttemptAt: now,
		refillEligible,
		notifyApplicant,
	});
	return { revision: app.revision + 1, refillEligible };
}

function validateAvailability(
	windows: readonly { day: string; start: number; end: number }[],
	period: Doc<"admissionPeriods">,
) {
	if (!isValidAvailability(windows))
		throw new ConvexError("Velg gyldige, ikke-overlappende tider.");
	const first = localDateAndMinute(period.interviewStartAt, period.timezone).day;
	const last = localDateAndMinute(period.interviewEndAt, period.timezone).day;
	if (windows.some((window) => window.day < first || window.day > last))
		throw new ConvexError("Tilgjengeligheten må ligge i intervjuperioden.");
}

export async function validateInterviewers(
	ctx: Parameters<typeof userHasRole>[0],
	selections: readonly { userId: Id<"users">; selectedCalendarIds: string[] }[],
) {
	const ids = selections.map((item) => item.userId);
	if (ids.length < 2 || ids.length > MAX_INTERVIEWERS || new Set(ids).size !== ids.length)
		throw new ConvexError("Velg minst to ulike intervjuere, maksimalt 30.");
	await requireActiveInterviewers(ctx, ids);
}

async function requireActiveInterviewers(
	ctx: Parameters<typeof userHasRole>[0],
	ids: Id<"users">[],
) {
	const eligible = await Promise.all(ids.map((id) => userHasRole(ctx, id, internalRoles)));
	if (eligible.some((value) => !value))
		throw new ConvexError("Alle intervjuere må være aktive interne medlemmer.");
}

export const createPeriod = mutation({
	args: {
		title: v.string(),
		applicationStartAt: v.number(),
		applicationEndAt: v.number(),
		interviewStartAt: v.number(),
		interviewEndAt: v.number(),
		retentionAt: v.number(),
		interviewers: v.array(interviewerSelection),
		duration: v.optional(v.number()),
		buffer: v.optional(v.number()),
		breakEvery: v.optional(v.number()),
		breakMinutes: v.optional(v.number()),
		lunch: v.optional(v.boolean()),
		room: v.optional(v.string()),
		dayStart: v.optional(v.number()),
		dayEnd: v.optional(v.number()),
		breaks: v.optional(v.array(availabilityWindow)),
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const creator = await requireRole(ctx, adminRoles);
		const title = args.title.trim();
		if (!title || title.length > 100) throw new ConvexError("Gi opptaksperioden et navn.");
		const fields = {
			...ADMISSION_SCHEDULING_DEFAULTS,
			...args,
			title,
			timezone: args.timezone ?? "Europe/Oslo",
		};
		validatePeriodWindow(fields);
		validateSettings(fields);
		await validateInterviewers(ctx, args.interviewers);
		const activeStatus = await Promise.all(
			["draft", "open", "published", "closing"].map((status) =>
				ctx.db
					.query("admissionPeriods")
					.withIndex("by_status", (q) =>
						q.eq("status", status as "draft" | "open" | "published" | "closing"),
					)
					.take(1),
			),
		);
		if (activeStatus.some((periods) => periods.length))
			throw new ConvexError("En annen opptaksperiode pågår allerede.");
		const status = "open" as const;
		const periodId = await ctx.db.insert("admissionPeriods", {
			title,
			applicationStartAt: fields.applicationStartAt,
			applicationEndAt: fields.applicationEndAt,
			interviewStartAt: fields.interviewStartAt,
			interviewEndAt: fields.interviewEndAt,
			retentionAt: fields.retentionAt,
			status,
			revision: 1,
			interviewers: args.interviewers,
			duration: fields.duration,
			buffer: fields.buffer,
			breakEvery: fields.breakEvery,
			breakMinutes: fields.breakMinutes,
			lunch: fields.lunch,
			room: fields.room,
			dayStart: fields.dayStart,
			dayEnd: fields.dayEnd,
			breaks: args.breaks ?? [],
			timezone: fields.timezone,
			round: 0,
			roundHistory: [],
			createdBy: creator._id,
			updatedBy: creator._id,
		});
		await ctx.scheduler.runAt(fields.retentionAt, internal.admissions.internal.closeExpiredPeriod, {
			periodId,
		});
		return periodId;
	},
});

export const saveDraft = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		about: v.string(),
		motivation: v.string(),
		group: admissionGroupChoice,
		availability: v.array(availabilityWindow),
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUserOrThrow(ctx);
		const now = Date.now();
		const period = await ctx.db.get(args.periodId);
		if (
			period?.status !== "open" ||
			now < period.applicationStartAt ||
			now > period.applicationEndAt
		)
			throw new ConvexError("Søknadsperioden er ikke åpen.");
		const student = await ctx.db
			.query("students")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.first();
		if (!student) throw new ConvexError("Fant ingen studentprofil for brukeren din.");
		if (
			!text(args.about, 5000) ||
			!args.about.trim() ||
			!text(args.motivation, 5000) ||
			!args.motivation.trim()
		)
			throw new ConvexError("Fyll ut alle svar med gyldig tekst.");
		await validateGroupChoice(ctx, args.group);
		validateAvailability(args.availability, period);
		const profile = {
			name: student.name,
			studyProgram: student.studyProgram,
			year: student.year,
			degree: student.degree,
		};
		const existing = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) =>
				q.eq("periodId", args.periodId).eq("userId", user._id),
			)
			.unique();
		if (existing?.status === "submitted") throw new ConvexError("Søknaden er allerede sendt.");
		if (existing) {
			const revision = existing.revision + 1;
			await ctx.db.patch(existing._id, {
				studentProfile: profile,
				about: args.about.trim(),
				motivation: args.motivation.trim(),
				group: args.group,
				availability: args.availability,
				status: "draft",
				revision,
			});
			return { applicationId: existing._id, revision };
		}
		const count = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", args.periodId).eq("status", "submitted"),
			)
			.take(MAX_APPLICATIONS);
		if (count.length >= MAX_APPLICATIONS) throw new ConvexError("Søknadsperioden er full.");
		const applicationId = await ctx.db.insert("admissionApplications", {
			periodId: args.periodId,
			userId: user._id,
			studentProfile: profile,
			about: args.about.trim(),
			motivation: args.motivation.trim(),
			group: args.group,
			availability: args.availability,
			status: "draft",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		});
		return { applicationId, revision: 1 };
	},
});

export const reopenApplication = mutation({
	args: { periodId: v.id("admissionPeriods"), expectedRevision: v.number() },
	handler: async (ctx, { periodId, expectedRevision }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const period = await ctx.db.get(periodId);
		const now = Date.now();
		if (
			period?.status !== "open" ||
			now < period.applicationStartAt ||
			now > period.applicationEndAt
		)
			throw new ConvexError("Søknadsperioden er ikke åpen.");
		const application = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) => q.eq("periodId", periodId).eq("userId", user._id))
			.unique();
		if (!application || application.revision !== expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		if (
			application.status !== "submitted" ||
			application.decisionSentAt ||
			application.offerStatus !== "none"
		)
			throw new ConvexError("Søknaden kan ikke åpnes for endring.");
		const interview = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
			.unique();
		if (interview?.status === "scheduled")
			throw new ConvexError("Søknaden kan ikke endres etter at intervju er planlagt.");
		await ctx.db.patch(application._id, { status: "draft", revision: application.revision + 1 });
		return { revision: application.revision + 1 };
	},
});

export const submit = mutation({
	args: { periodId: v.id("admissionPeriods"), expectedRevision: v.number(), consent: v.boolean() },
	handler: async (ctx, { periodId, expectedRevision, consent }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const period = await ctx.db.get(periodId);
		if (
			period?.status !== "open" ||
			Date.now() < period.applicationStartAt ||
			Date.now() > period.applicationEndAt
		)
			throw new ConvexError("Søknadsperioden er ikke åpen.");
		const application = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) => q.eq("periodId", periodId).eq("userId", user._id))
			.unique();
		if (!application) throw new ConvexError("Fant ikke søknaden.");
		if (application.status !== "draft") throw new ConvexError("Søknaden er allerede sendt.");
		if (application.revision !== expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		const submitted = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "submitted"),
			)
			.take(MAX_APPLICATIONS);
		if (submitted.length >= MAX_APPLICATIONS) throw new ConvexError("Søknadsperioden er full.");
		if (!consent) throw new ConvexError("Bekreft samtykke før du sender søknaden.");
		if (
			!application.about?.trim() ||
			!application.motivation?.trim() ||
			!application.group ||
			!application.studentProfile
		)
			throw new ConvexError("Fyll ut søknaden før du sender den.");
		await ctx.db.patch(application._id, {
			status: "submitted",
			revision: application.revision + 1,
			consentedAt: Date.now(),
			consentVersion: CONSENT_VERSION,
		});
		return { revision: application.revision + 1 };
	},
});

export const withdraw = mutation({
	args: { periodId: v.id("admissionPeriods"), expectedRevision: v.number() },
	handler: async (ctx, { periodId, expectedRevision }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const app = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) => q.eq("periodId", periodId).eq("userId", user._id))
			.unique();
		if (!app || app.revision !== expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		if (app.decisionSentAt || app.offerStatus !== "none")
			throw new ConvexError("Tilbudet må besvares før søknaden kan trekkes.");
		await ctx.db.patch(app._id, { status: "withdrawn", revision: app.revision + 1 });
	},
});

export const setDecision = mutation({
	args: {
		applicationId: v.id("admissionApplications"),
		decision: decisionValue,
		reviewedGroupId: v.optional(v.id("internalGroups")),
		reviewedWorkspaceEmail: v.optional(v.string()),
		expectedRevision: v.number(),
	},
	handler: async (ctx, args) => {
		const caller = await requireRole(ctx, adminRoles);
		const app = await ctx.db.get(args.applicationId);
		if (!app) throw new ConvexError("Fant ikke søknaden.");
		await requireMutablePeriod(ctx, app.periodId);
		if (app.revision !== args.expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		if (
			app.status !== "submitted" ||
			app.decisionQueuedAt !== undefined ||
			app.offerStatus === "pending" ||
			app.offerStatus === "accepted" ||
			app.offerStatus === "declined"
		)
			throw new ConvexError("Søknaden kan ikke vurderes nå.");
		let reviewedGroup: string | undefined;
		if (args.decision === "accepted") {
			if (!args.reviewedGroupId || !args.reviewedWorkspaceEmail?.trim())
				throw new ConvexError("Godkjenn gruppe og e-post før du sender et tilbud.");
			const group = await ctx.db.get(args.reviewedGroupId);
			if (!group) throw new ConvexError("Den valgte arbeidsgruppen finnes ikke lenger.");
			reviewedGroup = group.name;
			await validateAdmissionOffer(ctx, app.userId, reviewedGroup, args.reviewedWorkspaceEmail);
		}
		const decisionRevision = app.decisionRevision + 1;
		const revision = app.revision + 1;
		await ctx.db.patch(app._id, {
			decision: args.decision,
			decisionRevision,
			revision,
			decisionBy: caller._id,
			decisionAt: Date.now(),
			reviewedGroup: args.decision === "accepted" ? reviewedGroup : undefined,
			reviewedGroupId: args.decision === "accepted" ? args.reviewedGroupId : undefined,
			reviewedWorkspaceEmail:
				args.decision === "accepted"
					? args.reviewedWorkspaceEmail?.trim().toLowerCase()
					: undefined,
			decisionQueuedAt: undefined,
			decisionSentAt: undefined,
			sent: false,
			offerStatus: "none",
			offerDeadline: undefined,
			offerRespondedAt: undefined,
		});
		return { revision, decisionRevision };
	},
});

export const addNote = mutation({
	args: {
		applicationId: v.id("admissionApplications"),
		note: v.string(),
		expectedRevision: v.number(),
	},
	handler: async (ctx, { applicationId, note, expectedRevision }) => {
		await requireRole(ctx, adminRoles);
		const app = await ctx.db.get(applicationId);
		if (!app || app.revision !== expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		await requireMutablePeriod(ctx, app.periodId);
		if (note.length > 5000) throw new ConvexError("Notatet er for langt.");
		await ctx.db.patch(app._id, { notes: note.trim() || undefined, revision: app.revision + 1 });
		return { revision: app.revision };
	},
});

export const sendDecision = mutation({
	args: {
		applicationId: v.id("admissionApplications"),
		expectedRevision: v.number(),
		idempotencyKey: v.string(),
	},
	handler: async (ctx, { applicationId, expectedRevision, idempotencyKey }) => {
		await requireRole(ctx, adminRoles);
		const app = await ctx.db.get(applicationId);
		if (!app) throw new ConvexError("Fant ikke søknaden.");
		const period = await requireMutablePeriod(ctx, app.periodId);
		if (app.revision !== expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		if (app.decision !== "accepted" && app.decision !== "rejected")
			throw new ConvexError("Velg endelig opptaksbeslutning først.");
		if (app.decision === "accepted" && (!app.reviewedGroup || !app.reviewedWorkspaceEmail))
			throw new ConvexError("Godkjenn gruppe og e-post før du sender et tilbud.");
		if (app.decision === "accepted")
			await validateAdmissionOffer(
				ctx,
				app.userId,
				app.reviewedGroup ?? "",
				app.reviewedWorkspaceEmail ?? "",
			);
		if (app.decisionSentAt || app.decisionQueuedAt) return { revision: app.revision };
		const kind = "send_decision" as const;
		await queueOutbox(ctx, {
			kind,
			periodId: period._id,
			applicationId,
			revision: app.decisionRevision,
			idempotencyKey,
			nextAttemptAt: Date.now(),
		});
		await ctx.db.patch(app._id, { decisionQueuedAt: Date.now() });
		return { revision: app.revision };
	},
});

export const respondToOffer = mutation({
	args: { periodId: v.id("admissionPeriods"), accept: v.boolean(), expectedRevision: v.number() },
	handler: async (ctx, { periodId, accept, expectedRevision }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const app = await ctx.db
			.query("admissionApplications")
			.withIndex("by_periodId_and_userId", (q) => q.eq("periodId", periodId).eq("userId", user._id))
			.unique();
		if (app?.decision !== "accepted" || !app.decisionSentAt)
			throw new ConvexError("Fant ikke et aktivt tilbud.");
		if (app.offerStatus === "accepted") {
			if (accept) return { offerStatus: app.offerStatus, revision: app.revision };
			throw new ConvexError("Tilbudet er allerede akseptert.");
		}
		if (app.offerStatus === "declined") {
			if (!accept) return { offerStatus: app.offerStatus, revision: app.revision };
			throw new ConvexError("Et avslått tilbud kan ikke aksepteres senere.");
		}
		if (app.revision !== expectedRevision || app.offerStatus !== "pending")
			throw new ConvexError("Fant ikke et aktivt tilbud.");
		if (app.offerDeadline !== undefined && Date.now() >= app.offerDeadline) {
			await ctx.db.patch(app._id, { offerStatus: "expired", revision: app.revision + 1 });
			return { offerStatus: "expired" as const, revision: app.revision + 1 };
		}
		const offerStatus = accept ? "accepted" : "declined";
		await ctx.db.patch(app._id, {
			offerStatus,
			offerRespondedAt: Date.now(),
			revision: app.revision + 1,
		});
		if (accept) {
			try {
				await startAcceptedAdmissionOnboarding(ctx, app._id);
			} catch {
				throw new ConvexError(
					"Svaret kunne ikke registreres akkurat nå. Kontakt opptaksansvarlig for hjelp.",
				);
			}
		} else
			await queueOutbox(ctx, {
				kind: "offer_declined",
				periodId,
				applicationId: app._id,
				revision: app.decisionRevision,
				idempotencyKey: `offer-declined:${app._id}:${app.decisionRevision}`,
				nextAttemptAt: Date.now(),
			});
		return { offerStatus, revision: app.revision + 1 };
	},
});

export const scheduleInterview = mutation({
	args: {
		applicationId: v.id("admissionApplications"),
		startAt: v.number(),
		interviewerIds: v.array(v.id("users")),
		selectedCalendarIds: v.array(v.string()),
		room: v.optional(v.string()),
		candidateConfirmedOutsideForm: v.optional(v.boolean()),
		confirmPublishedReschedule: v.optional(v.boolean()),
		expectedRevision: v.number(),
	},
	handler: async (ctx, args) => {
		const caller = await requireRole(ctx, adminRoles);
		const app = await ctx.db.get(args.applicationId);
		if (!app) throw new ConvexError("Fant ikke søknaden.");
		const period = await requireMutablePeriod(ctx, app.periodId);
		if (app.revision !== args.expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		const unique = [...new Set(args.interviewerIds)];
		if (unique.length !== 2 || unique.length !== args.interviewerIds.length)
			throw new ConvexError("Velg nøyaktig to intervjuere uten gjentakelser.");
		const selected = new Set(period.interviewers.map((selection) => selection.userId));
		if (unique.some((id) => !selected.has(id)))
			throw new ConvexError("Velg intervjuere fra periodens oppsett.");
		await requireActiveInterviewers(ctx, unique);
		const meeting = manualInterviewWindow(args.startAt, period);
		assertApplicantAvailable(app, meeting, args.candidateConfirmedOutsideForm);
		const configuredCalendarIds = [
			...new Set(
				unique.flatMap(
					(userId) =>
						period.interviewers.find((selection) => selection.userId === userId)
							?.selectedCalendarIds ?? [],
				),
			),
		].sort((left, right) => left.localeCompare(right));
		const requestedCalendarIds = [...new Set(args.selectedCalendarIds)].sort((left, right) =>
			left.localeCompare(right),
		);
		if (
			configuredCalendarIds.length !== requestedCalendarIds.length ||
			configuredCalendarIds.some((calendarId, index) => calendarId !== requestedCalendarIds[index])
		)
			throw new ConvexError("Kalendervalgene må komme fra periodens oppsett.");
		const previous = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
			.unique();
		const room = args.room?.trim() || period.room;
		const existing = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", period._id).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS);
		const occupied = existing.filter((item) => item.applicationId !== app._id);
		if (
			occupied.some(
				(item) =>
					item.startAt < args.startAt + (period.duration + period.buffer) * 60000 &&
					args.startAt < item.endAt + period.buffer * 60000 &&
					(item.room === room || item.interviewerIds.some((id) => unique.includes(id))),
			)
		)
			throw new ConvexError("En intervjuer eller rommet er allerede opptatt i denne tiden.");
		const sameSchedule = await validatePreviousInterviewEdit(ctx, period._id, previous, {
			startAt: args.startAt,
			endAt: args.startAt + period.duration * 60_000,
			room,
			interviewerIds: unique,
			calendarIds: configuredCalendarIds,
			confirmedOutsideForm: args.candidateConfirmedOutsideForm,
			confirmPublishedReschedule: args.confirmPublishedReschedule,
		});
		const fields = {
			periodId: period._id,
			applicationId: app._id,
			startAt: args.startAt,
			endAt: args.startAt + period.duration * 60000,
			interviewerIds: unique,
			selectedCalendarIds: configuredCalendarIds,
			candidateConfirmedOutsideForm: args.candidateConfirmedOutsideForm || undefined,
			room,
			status: "scheduled" as const,
			revision: (previous?.revision ?? 0) + 1,
			calendarEventId: previous?.calendarEventId,
			publishedAt: sameSchedule ? previous?.publishedAt : undefined,
		};
		if (previous) await ctx.db.replace(previous._id, fields);
		else await ctx.db.insert("admissionInterviews", fields);
		await ctx.db.patch(app._id, { revision: app.revision + 1 });
		await ctx.db.patch(period._id, {
			status: "open",
			revision: period.revision + 1,
			updatedBy: caller._id,
		});
		return { revision: app.revision + 1, interviewRevision: fields.revision };
	},
});

function assertInterviewNotice(startAt: number) {
	if (startAt < Date.now() + MIN_INTERVIEW_NOTICE_MS)
		throw new ConvexError("Nye intervjuer må planlegges minst 48 timer fram i tid.");
}

export const cancelInterviewByBoard = mutation({
	args: {
		applicationId: v.id("admissionApplications"),
		expectedRevision: v.number(),
		idempotencyKey: v.string(),
	},
	handler: async (ctx, { applicationId, expectedRevision, idempotencyKey }) => {
		await requireRole(ctx, adminRoles);
		const app = await ctx.db.get(applicationId);
		if (!app) throw new ConvexError("Fant ikke søknaden.");
		const existingJob = await ctx.db
			.query("admissionOutbox")
			.withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
			.unique();
		if (existingJob) {
			if (existingJob.kind !== "cancel_interview" || existingJob.applicationId !== app._id)
				throw new ConvexError("Idempotensnøkkelen er allerede brukt.");
			return { revision: app.revision, refillEligible: existingJob.refillEligible ?? false };
		}
		if (app.revision !== expectedRevision)
			throw new ConvexError("Søknaden er endret. Last den inn på nytt.");
		const period = await ctx.db.get(app.periodId);
		if (!period || period.status === "closing") throw new ConvexError("Opptaksperioden er stengt.");
		const interview = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
			.unique();
		if (interview?.status !== "scheduled") throw new ConvexError("Fant ikke et planlagt intervju.");
		return await cancelScheduledInterview(
			ctx,
			app,
			period,
			interview,
			idempotencyKey,
			interview.publishedAt !== undefined,
		);
	},
});

export const cancelInterview = mutation({
	args: {
		applicationId: v.id("admissionApplications"),
		expectedRevision: v.number(),
		idempotencyKey: v.string(),
	},
	handler: async (ctx, { applicationId, expectedRevision, idempotencyKey }) => {
		const user = await getCurrentUserOrThrow(ctx);
		const app = await ctx.db.get(applicationId);
		if (!app || app.userId !== user._id || app.revision !== expectedRevision)
			throw new ConvexError("Fant ikke intervjuet ditt.");
		const period = await ctx.db.get(app.periodId);
		if (!period || period.status === "closing") throw new ConvexError("Opptaksperioden er stengt.");
		const interview = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
			.unique();
		if (interview?.status !== "scheduled" || !interview.publishedAt)
			throw new ConvexError("Du har ikke et publisert intervju å avbestille.");
		return await cancelScheduledInterview(ctx, app, period, interview, idempotencyKey, false);
	},
});

export const publish = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		expectedRevision: v.number(),
		idempotencyKey: v.string(),
	},
	handler: async (ctx, { periodId, expectedRevision, idempotencyKey }) => {
		await requireRole(ctx, adminRoles);
		const period = await requireMutablePeriod(ctx, periodId);
		if (period.revision !== expectedRevision)
			throw new ConvexError("Opptaksperioden er endret. Last den inn på nytt.");
		const interviews = await ctx.db
			.query("admissionInterviews")
			.withIndex("by_periodId_and_status", (q) =>
				q.eq("periodId", periodId).eq("status", "scheduled"),
			)
			.take(MAX_APPLICATIONS);
		if (!interviews.length) throw new ConvexError("Planlegg minst ett intervju før publisering.");
		for (const interview of interviews)
			if (interview.startAt < period.interviewStartAt || interview.endAt > period.interviewEndAt)
				throw new ConvexError("Et intervju ligger utenfor vinduet.");
		await ctx.db.patch(periodId, { status: "published", revision: period.revision + 1 });
		await Promise.all(
			interviews.map((interview) =>
				queueOutbox(ctx, {
					kind: "publish",
					periodId,
					applicationId: interview.applicationId,
					interviewId: interview._id,
					revision: interview.revision,
					idempotencyKey: `${idempotencyKey}:${interview._id}`,
					nextAttemptAt: Date.now(),
				}),
			),
		);
		return { revision: period.revision + 1, count: interviews.length };
	},
});

export const closePeriod = mutation({
	args: {
		periodId: v.id("admissionPeriods"),
		idempotencyKey: v.string(),
		force: v.optional(v.boolean()),
	},
	handler: async (ctx, { periodId, idempotencyKey, force = false }) => {
		await requireRole(ctx, adminRoles);
		const period = await ctx.db.get(periodId);
		if (!period) return null;
		if (period.status === "closing") return null;
		await beginClose(ctx, period, force, idempotencyKey);
		return null;
	},
});
