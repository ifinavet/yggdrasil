import { hasEventText } from "@workspace/shared/events/checklist";
import { PLANNING_PATH } from "@workspace/shared/events/planning";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import {
	eventSemesterOf,
	eventSemesterRange,
	osloDateTimeToEpoch,
	osloToday,
} from "@workspace/shared/time";
import { ConvexError, v } from "convex/values";
import { api } from "../../_generated/api";
import { mutation, query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import { isLocalDevelopment } from "../../auth/local";
import { previousCompanyReport } from "../../companies/history";
import { generateLinkToken, hashLinkToken } from "../../lib/tokens";
import { countRegistrationsWithStatus } from "../helper";
import { getOrganizers } from "../queries";
import { queueEmail } from "./delivery";
import {
	capacityLimit,
	companyView,
	ensurePlanning,
	envelopeFingerprint,
	eventSnapshot,
	initialPlanning,
	invitationPreview,
	parseAnswers,
	planningForEvent,
	publicUrl,
	requireEvent,
} from "./helpers";
import { notifyPlanning } from "./notifications";
import { answers, preparation } from "./schema";

const eventArgs = { eventId: v.id("events") };
export const get = query({
	args: eventArgs,
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const event = await requireEvent(ctx, eventId);
		const planning = await planningForEvent(ctx, eventId);
		const initial = planning ?? (await initialPlanning(ctx, event));
		const submission =
			planning?.status === "invited" && planning.latestSubmissionId
				? await ctx.db.get(planning.latestSubmissionId)
				: null;
		const latestAnswer = planning
			? await ctx.db
					.query("eventPlanningSubmissions")
					.withIndex("by_planningId", (q) => q.eq("planningId", planning._id))
					.order("desc")
					.first()
			: null;
		const recentEmails = planning
			? await ctx.db
					.query("eventPlanningEmails")
					.withIndex("by_planningId", (q) => q.eq("planningId", planning._id))
					.order("desc")
					.take(30)
			: [];
		const unresolvedEmails = planning
			? await ctx.db
					.query("eventPlanningEmails")
					.withIndex("by_planningId", (q) => q.eq("planningId", planning._id))
					.filter((q) =>
						q.and(q.neq(q.field("error"), undefined), q.eq(q.field("resolvedAt"), undefined)),
					)
					.take(20)
			: [];
		const emails = [
			...new Map(
				[...recentEmails, ...unresolvedEmails].map((email) => [email._id, email]),
			).values(),
		];
		const { semester, year } = eventSemesterOf(event.eventStart);
		const { start } = eventSemesterRange(semester, year);
		const channel = await ctx.db
			.query("companySemesterSlackChannels")
			.withIndex("by_companyId_and_semesterStart", (q) =>
				q.eq("companyId", event.hostingCompany).eq("semesterStart", start),
			)
			.unique();
		const slackFailures = await ctx.db
			.query("eventSlackNotifications")
			.withIndex("by_eventId_and_key", (q) => q.eq("eventId", eventId))
			.filter((q) => q.neq(q.field("lastError"), undefined))
			.take(20);
		const systemFailures = await ctx.db
			.query("slackSystemDeliveries")
			.withIndex("by_channel_and_clientMsgId", (q) =>
				q
					.eq("channel", SYSTEM_ALERTS_CHANNEL)
					.gte("clientMsgId", `planning:${eventId}:`)
					.lt("clientMsgId", `planning:${eventId};`),
			)
			.filter((q) =>
				q.and(q.eq(q.field("status"), "pending"), q.neq(q.field("lastError"), undefined)),
			)
			.take(20);
		return {
			planning,
			initial,
			awaitingConfirmation:
				planning?.status === "invited" &&
				latestAnswer?.generation === planning.generation &&
				latestAnswer?.status === "awaiting_email",
			submission,
			event,
			snapshot: eventSnapshot(event),
			previousReport: await previousCompanyReport(ctx, event, event.eventStart),
			preview: planning ? await invitationPreview(ctx, planning, event) : null,
			company: await companyView(ctx, {
				companyId: event.hostingCompany,
				eventType: initial.eventType,
			}),
			capacityLimit: await capacityLimit(ctx, initial, event),
			emails: emails.map(({ url, ...email }) => ({
				...email,
				...(isLocalDevelopment() ? { url } : {}),
			})),
			slackErrors: [
				...(channel?.lastError ? [channel.lastError] : []),
				...slackFailures.map((n) => n.lastError!),
				...systemFailures
					.filter((n) => n.clientMsgId.startsWith(`planning:${eventId}:`))
					.map((n) => n.lastError!),
			],
			local: isLocalDevelopment(),
		};
	},
});
export const savePreparation = mutation({
	args: { ...eventArgs, ...preparation, revision: v.number() },
	handler: async (ctx, { eventId, revision, ...fields }) => {
		await requireRole(ctx, internalRoles);
		const event = await requireEvent(ctx, eventId, Date.now());
		const planning = await ensurePlanning(ctx, event);
		if (planning.revision !== revision)
			throw new ConvexError("Opplysningene er endret. Last inn på nytt.");
		if (
			fields.contactName.length > 150 ||
			fields.contactEmail.length > 254 ||
			fields.signature.length > 2000
		)
			throw new ConvexError("Kontaktinformasjonen er for lang.");
		const parsed = await parseAnswers(ctx, fields, event, fields.answers);
		const changedContact =
			planning.contactEmail !== fields.contactEmail.trim().toLowerCase() ||
			planning.companyId !== event.hostingCompany ||
			planning.eventType !== fields.eventType;
		await ctx.db.patch(planning._id, {
			...fields,
			contactName: fields.contactName.trim(),
			contactEmail: fields.contactEmail.trim().toLowerCase(),
			answers: parsed,
			revision: revision + 1,
			companyId: event.hostingCompany,
			...(changedContact
				? {
						generation: planning.generation + 1,
						tokenHash: undefined,
						status: "preparing" as const,
						latestSubmissionId: undefined,
					}
				: {}),
			error: undefined,
		});
	},
});
export const send = mutation({
	args: { ...eventArgs, revision: v.number(), fingerprint: v.string() },
	handler: async (ctx, { eventId, revision, fingerprint }) => {
		const user = await requireRole(ctx, internalRoles);
		const event = await requireEvent(ctx, eventId, Date.now());
		const planning = await planningForEvent(ctx, eventId);
		if (!planning || planning.revision !== revision)
			throw new ConvexError("Lagre opplysningene og se gjennom invitasjonen på nytt.");
		const preview = await invitationPreview(ctx, planning, event);
		if (preview.fingerprint !== fingerprint)
			throw new ConvexError(
				"Mottaker, arrangør eller arrangement er endret. Se over invitasjonen på nytt.",
			);
		if (preview.blockers.length) throw new ConvexError(preview.blockers[0]!);
		await parseAnswers(ctx, planning, event, planning.answers);
		if (planning.status === "invited")
			throw new ConvexError(
				"Invitasjonen er allerede sendt. Bruk leveringspanelet for å følge opp.",
			);
		const token = generateLinkToken();
		const generation = planning.generation + 1;
		await ctx.db.patch(planning._id, {
			status: "invited",
			generation,
			tokenHash: await hashLinkToken(token),
			sentAt: Date.now(),
			sentBy: user._id,
			error: undefined,
			revision: revision + 1,
		});
		await queueEmail(ctx, {
			planningId: planning._id,
			kind: "invitation",
			generation,
			eventStart: event.eventStart,
			envelope: preview.envelope,
			url: publicUrl(PLANNING_PATH, token),
		});
	},
});
export const saveReview = mutation({
	args: { submissionId: v.id("eventPlanningSubmissions"), revision: v.number(), answers },
	handler: async (ctx, { submissionId, revision, answers: input }) => {
		await requireRole(ctx, internalRoles);
		const submission = await ctx.db.get(submissionId);
		if (submission?.status !== "ready" || submission.revision !== revision)
			throw new ConvexError("Svarene har endret seg. Åpne gjennomgangen på nytt.");
		const planning = await ctx.db.get(submission.planningId);
		if (
			planning?.status !== "invited" ||
			planning.generation !== submission.generation ||
			planning.latestSubmissionId !== submissionId
		)
			throw new ConvexError("Det finnes nyere svar.");
		const event = await requireEvent(ctx, planning.eventId, Date.now());
		if (event.hostingCompany !== planning.companyId)
			throw new ConvexError("Bedriften er endret. Klargjør en ny invitasjon.");
		const draft = await parseAnswers(ctx, planning, event, input);
		await ctx.db.patch(submissionId, { draft, revision: revision + 1 });
	},
});
export const approve = mutation({
	args: {
		submissionId: v.id("eventPlanningSubmissions"),
		revision: v.number(),
		expectedEvent: v.string(),
		acknowledgeChanges: v.boolean(),
		foodItem: v.id("foodItems"),
		registrationOpens: v.number(),
	},
	handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
		const user = await requireRole(ctx, internalRoles);
		const submission = await ctx.db.get(args.submissionId);
		if (submission?.status !== "ready" || submission.revision !== args.revision)
			throw new ConvexError("Svarene har endret seg. Åpne gjennomgangen på nytt.");
		const planning = await ctx.db.get(submission.planningId);
		if (
			planning?.status !== "invited" ||
			planning.latestSubmissionId !== submission._id ||
			planning.generation !== submission.generation
		)
			throw new ConvexError("Svarene gjelder ikke lenger.");
		const event = await requireEvent(ctx, planning.eventId, Date.now());
		if (event.hostingCompany !== planning.companyId)
			throw new ConvexError("Bedriften er endret. Klargjør en ny invitasjon.");
		if (eventSnapshot(event) !== args.expectedEvent)
			throw new ConvexError("Arrangementet er endret under gjennomgangen. Last inn på nytt.");
		if (submission.baseEvent !== args.expectedEvent && !args.acknowledgeChanges)
			throw new ConvexError("Se gjennom endringene på arrangementet før godkjenning.");
		const draft = await parseAnswers(ctx, planning, event, submission.draft);
		if (
			![draft.title, draft.teaser, draft.description, draft.location, draft.language].every(
				hasEventText,
			) ||
			draft.ageRestriction === "unsure"
		)
			throw new ConvexError(
				"Fyll inn tittel, introduksjon, beskrivelse, sted, språk og aldersgrense før publisering.",
			);
		const eventStart = osloDateTimeToEpoch(osloToday(event.eventStart), draft.startTime);
		if (
			eventStart <= Date.now() ||
			!Number.isFinite(args.registrationOpens) ||
			args.registrationOpens > eventStart
		)
			throw new ConvexError("Kontroller starttid og åpning av påmeldingen.");
		if (draft.capacity < (await countRegistrationsWithStatus(ctx, event._id, "registered")))
			throw new ConvexError("Kapasiteten kan ikke være lavere enn antall påmeldte.");
		const organizers = await getOrganizers(ctx, event._id);
		try {
			await ctx.runMutation(api.events.mutations.update, {
				id: event._id,
				title: draft.title,
				teaser: draft.teaser,
				description: draft.description,
				eventStart,
				registrationOpens: args.registrationOpens,
				participationLimit: draft.capacity,
				location: draft.location,
				foodItem: args.foodItem,
				language: draft.language,
				ageRestriction: draft.ageRestriction === "18" ? "18 år" : "Ingen aldersgrense",
				hostingCompany: event.hostingCompany,
				externalEvent: false,
				published: true,
				organizers: organizers.map(({ userId, role }) => ({ userId, role })),
			});
		} catch {
			const error =
				"Publisering av arrangementet på nettsiden feilet. Utkastet er bevart. Prøv igjen eller følg opp manuelt.";
			await ctx.db.patch(planning._id, { error });
			await notifyPlanning(
				ctx,
				event,
				`publish-error:${submission._id}:${submission.revision}`,
				error,
				"review",
			);
			return { ok: false, error };
		}
		await ctx.db.patch(submission._id, {
			status: "approved",
			decidedAt: Date.now(),
			decidedBy: user._id,
		});
		await ctx.db.patch(planning._id, {
			answers: draft,
			error: undefined,
			revision: planning.revision + 1,
		});
		return { ok: true };
	},
});
export const resolveManually = mutation({
	args: { ...eventArgs, note: v.string() },
	handler: async (ctx, { eventId, note }) => {
		const user = await requireRole(ctx, internalRoles);
		if (!note.trim() || note.length > 2000)
			throw new ConvexError("Beskriv den manuelle oppfølgingen, høyst 2000 tegn.");
		const event = await requireEvent(ctx, eventId);
		const planning = await ensurePlanning(ctx, event);
		await ctx.db.patch(planning._id, {
			status: "manual",
			tokenHash: undefined,
			generation: planning.generation + 1,
			manualNote: note.trim(),
			resolvedAt: Date.now(),
			resolvedBy: user._id,
			error: undefined,
			revision: planning.revision + 1,
		});
		await ctx.db.patch(eventId, {
			completedChecklistSteps: [
				...new Set([...(event.completedChecklistSteps ?? []), "company-contact"]),
			],
		});
	},
});
export const reopen = mutation({
	args: eventArgs,
	handler: async (ctx, { eventId }) => {
		await requireRole(ctx, internalRoles);
		const event = await requireEvent(ctx, eventId, Date.now());
		const planning = await ensurePlanning(ctx, event);
		await ctx.db.patch(planning._id, {
			status: "preparing",
			latestSubmissionId: undefined,
			tokenHash: undefined,
			generation: planning.generation + 1,
			revision: planning.revision + 1,
			error: undefined,
		});
	},
});
export const resolveEmail = mutation({
	args: { id: v.id("eventPlanningEmails"), note: v.string() },
	handler: async (ctx, { id, note }) => {
		const user = await requireRole(ctx, internalRoles);
		if (!note.trim() || note.length > 2000) throw new ConvexError("Beskriv oppfølgingen.");
		await ctx.db.patch(id, {
			resolvedAt: Date.now(),
			resolvedBy: user._id,
			resolution: note.trim(),
		});
	},
});
export const retryEmail = mutation({
	args: { id: v.id("eventPlanningEmails") },
	handler: async (ctx, { id }) => {
		await requireRole(ctx, internalRoles);
		const email = await ctx.db.get(id);
		if (!email || !(["failed", "bounced", "cancelled"] as string[]).includes(email.status))
			throw new ConvexError("Kontroller leveringsstatus før ny sending.");
		const planning = await ctx.db.get(email.planningId);
		if (!planning || planning.generation !== email.generation || planning.status !== "invited")
			throw new ConvexError("Klargjør en ny invitasjon etter endringene.");
		const event = await requireEvent(ctx, planning.eventId, Date.now());
		if (email.resolvedAt || email.eventStart !== event.eventStart)
			throw new ConvexError("Klargjør en ny invitasjon etter endringene.");
		if (email.status === "bounced")
			throw new ConvexError("Korriger mottakeradressen og klargjør en ny invitasjon.");
		if (email.kind === "confirmation")
			throw new ConvexError("Bedriften kan be om en ny bekreftelseslenke i skjemaet.");
		const preview = await invitationPreview(ctx, planning, event);
		if (
			preview.blockers.length ||
			envelopeFingerprint(preview.envelope) !== envelopeFingerprint(email.envelope)
		)
			throw new ConvexError("Mottaker eller arrangør er endret. Klargjør en ny invitasjon.");
		const token = generateLinkToken();
		await ctx.db.patch(planning._id, { tokenHash: await hashLinkToken(token) });
		await ctx.db.patch(email._id, {
			resolvedAt: Date.now(),
			resolution: "Ny sending bestilt",
			url: undefined,
		});
		await queueEmail(ctx, {
			planningId: email.planningId,
			kind: email.kind,
			generation: email.generation,
			eventStart: event.eventStart,
			envelope: email.envelope,
			url: publicUrl(PLANNING_PATH, token),
		});
	},
});
