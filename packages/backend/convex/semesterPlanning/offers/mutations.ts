import { MAX_OFFER_COMMENT_LENGTH, MAX_REQUESTED_DATES } from "@workspace/shared/semester/limits";
import { addOsloDays } from "@workspace/shared/semester/time";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { type MutationCtx, mutation } from "../../_generated/server";
import { generateLinkToken } from "../../lib/tokens";
import { requireEditorActor, transitionApplicationStatus } from "../applicationLifecycle";
import { requireApplication } from "../applications/helper";
import { rateLimiter } from "../rateLimits";
import { listSemesterDates, requireSemester } from "../semesters/helper";
import { findOfferByToken, requireAnswerableOffer, supersedePendingOffers } from "./helper";
import { NEW_DATE_ALREADY_REQUESTED_MESSAGE } from "./messages";

async function rateLimitOfferResponse(
	ctx: MutationCtx,
	offer: Doc<"companyApplicationOffers">,
): Promise<void> {
	const { ok } = await rateLimiter.limit(ctx, "offerResponse", { key: offer._id });
	if (!ok) throw new ConvexError("For mange forsøk. Prøv igjen om litt.");
}

/**
 * Makes an offer for the application's assigned date with a new link token, replaces any earlier
 * offer and moves the application to «Tilbud sendt». Nothing is emailed: Bifrost builds the link
 * from the token, and Navet sends it by hand.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 *
 * @throws - An error if the caller is not an editor, the application has no date, or its status
 * does not allow an offer.
 * @returns {{ offerId: Id<"companyApplicationOffers">, linkToken: string, respondBy?: number }} - The offer, its link token and its deadline.
 */
export const sendOffer = mutation({
	args: { applicationId: v.id("companyApplications") },
	returns: v.object({
		offerId: v.id("companyApplicationOffers"),
		linkToken: v.string(),
		respondBy: v.optional(v.number()),
	}),
	handler: async (ctx, { applicationId }) => {
		const actor = await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);
		if (!application.assignedDate) {
			throw new ConvexError("Gi søknaden en dato før du sender tilbud.");
		}
		const semester = await requireSemester(ctx, application.semesterId);
		if (semester.status === "closed") throw new ConvexError("Semesteret er stengt.");

		const linkToken = generateLinkToken();
		const sentAt = Date.now();
		const respondBy = semester.offerResponseDays
			? addOsloDays(sentAt, semester.offerResponseDays)
			: undefined;

		await supersedePendingOffers(ctx, applicationId);
		const offerId = await ctx.db.insert("companyApplicationOffers", {
			applicationId,
			date: application.assignedDate,
			eventType: application.eventType,
			maxStudents: application.maxStudents,
			linkToken,
			sentAt,
			sentBy: actor.userId,
			status: "pending",
			...(respondBy ? { respondBy } : {}),
		});

		await transitionApplicationStatus(ctx, application, "offer_sent", actor, {
			offerId,
		});

		return { offerId, linkToken, ...(respondBy ? { respondBy } : {}) };
	},
});

/**
 * The company accepts the offered date and the standard terms, from the link. Accepting twice is
 * harmless. Public: the link token is the only credential.
 *
 * @param {string} token - The token from the offer link.
 * @param {boolean} acceptTerms - Must be true.
 *
 * @throws - A Norwegian error when the terms are not accepted, or the link cannot be answered.
 * @returns {null} - Returns null when the offer is accepted.
 */
export const accept = mutation({
	args: { token: v.string(), acceptTerms: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { token, acceptTerms }) => {
		if (!acceptTerms) throw new ConvexError("Du må godta standardvilkårene for å godta datoen.");

		const { offer, application } = await requireAnswerableOffer(
			ctx,
			await findOfferByToken(ctx, token),
		);
		if (offer.status === "accepted") return null;
		if (offer.status === "new_date_requested")
			throw new ConvexError(NEW_DATE_ALREADY_REQUESTED_MESSAGE);
		await rateLimitOfferResponse(ctx, offer);

		const semester = await requireSemester(ctx, application.semesterId);
		await ctx.db.patch(offer._id, {
			status: "accepted",
			respondedAt: Date.now(),
			...(semester.termsUrl ? { acceptedTermsUrl: semester.termsUrl } : {}),
		});
		await transitionApplicationStatus(
			ctx,
			application,
			"confirmed",
			{ type: "company" },
			{ offerId: offer._id },
		);

		return null;
	},
});

/**
 * The company asks for other dates instead of the offered one, from the link. The offered date
 * stays held until the bedriftskontakt assigns a new one. Public: the link token is the only
 * credential.
 *
 * @param {string} token - The token from the offer link.
 * @param {string[]} dates - One to ten open semester days that suit better.
 * @param {string} [comment] - Anything the bedriftskontakt should know.
 *
 * @throws - A Norwegian error when the dates are not open, or the link cannot be answered.
 * @returns {null} - Returns null when the request is saved.
 */
export const requestNewDate = mutation({
	args: { token: v.string(), dates: v.array(v.string()), comment: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { token, dates, comment }) => {
		const { offer, application } = await requireAnswerableOffer(
			ctx,
			await findOfferByToken(ctx, token),
		);
		if (offer.status === "accepted") throw new ConvexError("Dere har allerede godtatt tilbudet.");
		if (offer.status === "new_date_requested")
			throw new ConvexError(NEW_DATE_ALREADY_REQUESTED_MESSAGE);
		await rateLimitOfferResponse(ctx, offer);

		const wanted = [...new Set(dates)];
		if (wanted.length < 1 || wanted.length > MAX_REQUESTED_DATES) {
			throw new ConvexError("Velg mellom én og ti datoer.");
		}
		const trimmed = comment?.trim();
		if (trimmed && trimmed.length > MAX_OFFER_COMMENT_LENGTH) {
			throw new ConvexError(`Kommentaren kan ha høyst ${MAX_OFFER_COMMENT_LENGTH} tegn.`);
		}

		const open = new Set(
			(await listSemesterDates(ctx, application.semesterId))
				.filter((date) => date.closedLabel === undefined)
				.map((date) => date.date),
		);
		if (!wanted.every((date) => open.has(date))) {
			throw new ConvexError("Velg blant datoene i semesteret.");
		}

		await ctx.db.patch(offer._id, {
			status: "new_date_requested",
			respondedAt: Date.now(),
			requestedDates: wanted,
			...(trimmed ? { responseComment: trimmed } : {}),
		});
		await transitionApplicationStatus(
			ctx,
			application,
			"new_date_requested",
			{ type: "company" },
			{
				offerId: offer._id,
				...(trimmed ? { comment: trimmed } : {}),
			},
		);

		return null;
	},
});

/**
 * The company declines the offer, from the link. The application is withdrawn by the company and
 * the date is free again. Declining twice is harmless, and a company that has asked for another
 * date can still decline. Only the newest offer can be declined, and only while the application
 * waits for the company's answer, so an old link can never withdraw a confirmed application.
 * Public: the link token is the only credential.
 *
 * @param {string} token - The token from the offer link.
 * @param {string} [comment] - Why, if the company wants to say.
 *
 * @throws - A Norwegian error when the offer is already accepted, or the link cannot be answered.
 * @returns {null} - Returns null when the offer is declined.
 */
export const decline = mutation({
	args: { token: v.string(), comment: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { token, comment }) => {
		const found = await findOfferByToken(ctx, token);
		if (found?.status === "declined") return null;

		const { offer, application } = await requireAnswerableOffer(ctx, found);
		if (offer.status === "accepted") {
			throw new ConvexError(
				"Dere har allerede godtatt tilbudet. Ta kontakt med bedriftskontakten for å avlyse.",
			);
		}
		if (application.status !== "offer_sent" && application.status !== "new_date_requested") {
			throw new ConvexError("Tilbudet gjelder ikke lenger.");
		}
		await rateLimitOfferResponse(ctx, offer);

		const trimmed = comment?.trim();
		if (trimmed && trimmed.length > MAX_OFFER_COMMENT_LENGTH) {
			throw new ConvexError(`Kommentaren kan ha høyst ${MAX_OFFER_COMMENT_LENGTH} tegn.`);
		}

		await ctx.db.patch(offer._id, {
			status: "declined",
			respondedAt: Date.now(),
			...(trimmed ? { responseComment: trimmed } : {}),
		});
		await transitionApplicationStatus(
			ctx,
			application,
			"withdrawn",
			{ type: "company" },
			{ offerId: offer._id, ...(trimmed ? { comment: trimmed } : {}) },
		);
		return null;
	},
});

/**
 * Marks an offer as accepted on the company's behalf, e.g. when it answered by email. The offer
 * is closed without a terms snapshot, so the history shows it was not accepted through the link.
 *
 * @param {Id<"companyApplications">} applicationId - The application.
 * @param {string} comment - How the company confirmed.
 *
 * @throws - An error if the caller is not an editor, the comment is empty, or the status is not
 * «Tilbud sendt».
 * @returns {null} - Returns null when the application is confirmed.
 */
export const confirmManually = mutation({
	args: { applicationId: v.id("companyApplications"), comment: v.string() },
	returns: v.null(),
	handler: async (ctx, { applicationId, comment }) => {
		const actor = await requireEditorActor(ctx);
		const application = await requireApplication(ctx, applicationId);
		const trimmed = comment.trim();
		if (!trimmed) throw new ConvexError("Skriv hvordan bedriften bekreftet.");

		const pending = await ctx.db
			.query("companyApplicationOffers")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.collect()
			.then((offers) => offers.find((offer) => offer.status === "pending"));

		await transitionApplicationStatus(ctx, application, "confirmed", actor, {
			...(pending ? { offerId: pending._id } : {}),
			comment: trimmed,
		});
		if (pending) await ctx.db.patch(pending._id, { status: "accepted", respondedAt: Date.now() });
		return null;
	},
});
