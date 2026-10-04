import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { INFO_EMAIL } from "@workspace/shared/constants/contact";
import { PLANNING_CONFIRM_PATH } from "@workspace/shared/events/planning";
import { osloToday } from "@workspace/shared/time";
import { SUBMISSION_ID_PATTERN } from "@workspace/shared/validation";
import { ConvexError, v } from "convex/values";
import { components } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { type MutationCtx, mutation } from "../../_generated/server";
import {
	confirmationFields,
	confirmationState,
	validEmailToken,
} from "../../lib/emailConfirmation";
import { generateLinkToken, hashLinkToken } from "../../lib/tokens";
import { queueEmail } from "./delivery";
import {
	capacityLimit,
	companyView,
	eventSnapshot,
	parseAnswers,
	planningByToken,
	publicUrl,
	senderFor,
} from "./helpers";
import { notifyPlanning } from "./notifications";
import { answers } from "./schema";

const limiter = new RateLimiter(components.rateLimiter, {
	planningSubmit: { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
	planningResend: { kind: "fixed window", rate: 1, period: MINUTE },
});
export const get = mutation({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		const context = await planningByToken(ctx, token);
		if (!context || context.event.eventStart <= Date.now()) return null;
		const { planning, event } = context;
		const sender = await senderFor(ctx, event._id);
		const latest = planning.latestSubmissionId
			? await ctx.db.get(planning.latestSubmissionId)
			: null;
		return {
			...(await companyView(ctx, planning)),
			eventDate: osloToday(event.eventStart),
			eventStart: event.eventStart,
			answers: latest?.status === "ready" ? latest.answers : planning.answers,
			capacityLimit: await capacityLimit(ctx, planning, event),
			revision: planning.revision,
			contactEmail: planning.contactEmail,
			organizerEmail: sender.mainEmail,
			organizers: sender.contacts,
			submitted: !!latest,
		};
	},
});
async function sendConfirmation(
	ctx: MutationCtx,
	planning: Doc<"eventPlanning">,
	submission: Doc<"eventPlanningSubmissions">,
	event: Doc<"events">,
) {
	const token = generateLinkToken();
	await ctx.db.insert("eventPlanningConfirmations", {
		submissionId: submission._id,
		...(await confirmationFields(token, Date.now())),
	});
	await queueEmail(ctx, {
		planningId: planning._id,
		submissionId: submission._id,
		kind: "confirmation",
		generation: planning.generation,
		eventStart: event.eventStart,
		envelope: {
			from: `Navet <${INFO_EMAIL}>`,
			to: planning.contactEmail,
			cc: [],
			replyTo: [],
			subject: "Bekreft opplysningene til arrangementet",
			text: `Hei ${planning.contactName}!\n\nBekreft opplysningene dere nettopp sendte inn for arrangementet med Navet. Lenken er gyldig i 24 timer.\n\nHvis dere ikke sendte inn opplysningene, kan dere se bort fra denne e-posten.\n\nMed vennlig hilsen\nNavet`,
		},
		url: publicUrl(PLANNING_CONFIRM_PATH, token),
	});
}
export const submit = mutation({
	args: { token: v.string(), submissionId: v.string(), revision: v.number(), answers },
	handler: async (ctx, { token, submissionId, revision, answers: input }) => {
		if (!SUBMISSION_ID_PATTERN.test(submissionId))
			throw new ConvexError("Last siden på nytt og prøv igjen.");
		const context = await planningByToken(ctx, token);
		if (!context || context.event.eventStart <= Date.now())
			throw new ConvexError("Lenken er ikke gyldig lenger. Kontakt Navet for hjelp.");
		const { planning, event } = context;
		const existing = await ctx.db
			.query("eventPlanningSubmissions")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.unique();
		if (existing) {
			if (existing.planningId !== planning._id || existing.generation !== planning.generation)
				throw new ConvexError("Ugyldig innsending.");
			return { email: planning.contactEmail };
		}
		if (planning.revision !== revision)
			throw new ConvexError("Opplysningene er endret siden du åpnet skjemaet. Last siden på nytt.");
		await limiter.limit(ctx, "planningSubmit", { key: planning._id, throws: true });
		const parsed = await parseAnswers(ctx, planning, event, input);
		const id = await ctx.db.insert("eventPlanningSubmissions", {
			planningId: planning._id,
			generation: planning.generation,
			submissionId,
			answers: parsed,
			draft: parsed,
			revision: 0,
			status: "awaiting_email",
			baseEvent: eventSnapshot(event),
			eventDate: osloToday(event.eventStart),
		});
		const submission = (await ctx.db.get(id))!;
		await sendConfirmation(ctx, planning, submission, event);
		return { email: planning.contactEmail };
	},
});
export const resend = mutation({
	args: { token: v.string(), submissionId: v.string() },
	handler: async (ctx, { token, submissionId }) => {
		const context = await planningByToken(ctx, token);
		if (!context || context.event.eventStart <= Date.now())
			throw new ConvexError("Lenken er ikke gyldig lenger.");
		const submission = await ctx.db
			.query("eventPlanningSubmissions")
			.withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
			.unique();
		if (
			!submission ||
			submission.planningId !== context.planning._id ||
			submission.generation !== context.planning.generation ||
			submission.status !== "awaiting_email"
		)
			throw new ConvexError("Opplysningene kan ikke bekreftes på nytt. Åpne skjemaet igjen.");
		await limiter.limit(ctx, "planningResend", { key: submission._id, throws: true });
		await sendConfirmation(ctx, context.planning, submission, context.event);
	},
});
export const confirm = mutation({
	args: { token: v.string() },
	handler: async (ctx, { token }): Promise<{ state: "invalid" | "expired" | "confirmed" }> => {
		if (!validEmailToken(token)) return { state: "invalid" };
		const hash = await hashLinkToken(token);
		const confirmation = await ctx.db
			.query("eventPlanningConfirmations")
			.withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
			.unique();
		const state = confirmationState(confirmation, Date.now());
		if (state !== "valid" || !confirmation)
			return { state: state === "expired" ? "expired" : "invalid" };
		const submission = await ctx.db.get(confirmation.submissionId);
		const planning = submission ? await ctx.db.get(submission.planningId) : null;
		const event = planning ? await ctx.db.get(planning.eventId) : null;
		if (
			!submission ||
			planning?.status !== "invited" ||
			planning.generation !== submission.generation ||
			!event ||
			event.externalEvent ||
			event.hostingCompany !== planning.companyId ||
			event.eventStart <= Date.now() ||
			osloToday(event.eventStart) !== submission.eventDate
		)
			return { state: "invalid" };
		if (confirmation.usedAt) return { state: "confirmed" };
		if (submission.status !== "awaiting_email") return { state: "invalid" };
		const newest = await ctx.db
			.query("eventPlanningSubmissions")
			.withIndex("by_planningId", (q) => q.eq("planningId", planning._id))
			.order("desc")
			.first();
		if (newest?._id !== submission._id) return { state: "invalid" };
		if (planning.latestSubmissionId) {
			const previous = await ctx.db.get(planning.latestSubmissionId);
			if (previous?.status === "ready") await ctx.db.patch(previous._id, { status: "superseded" });
		}
		await ctx.db.patch(confirmation._id, { usedAt: Date.now() });
		await ctx.db.patch(submission._id, { status: "ready", confirmedAt: Date.now() });
		await ctx.db.patch(planning._id, {
			latestSubmissionId: submission._id,
			revision: planning.revision + 1,
			error: undefined,
		});
		await notifyPlanning(
			ctx,
			event,
			`review:${submission._id}`,
			"Bedriften har bekreftet opplysningene til arrangementet. Se gjennom, rediger og godkjenn før publisering.",
			"review",
		);
		return { state: "confirmed" };
	},
});
