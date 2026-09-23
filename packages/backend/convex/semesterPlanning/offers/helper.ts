import { ConvexError } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { hashToken } from "../../lib/tokens";

/**
 * Finds the offer behind a link token. Only the hash is stored, so the token is hashed first.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {string} token - The token from the offer link.
 *
 * @returns {Promise<Doc<"companyApplicationOffers"> | null>} - The offer, or null for an unknown token.
 */
export async function findOfferByToken(
	ctx: QueryCtx | MutationCtx,
	token: string,
): Promise<Doc<"companyApplicationOffers"> | null> {
	if (token.length < 20 || token.length > 200) return null;

	const tokenHash = await hashToken(token);
	return ctx.db
		.query("companyApplicationOffers")
		.withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
		.first();
}

/**
 * Loads the offer and application behind a link a company is answering, and refuses links that
 * are unknown, replaced, or belong to a withdrawn or rejected application. Unknown and replaced
 * links get messages that reveal nothing about other offers.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {string} token - The token from the offer link.
 *
 * @throws - A Norwegian error when the link cannot be answered.
 * @returns {Promise<{ offer: Doc<"companyApplicationOffers">, application: Doc<"companyApplications"> }>} - The offer and application.
 */
export async function requireAnswerableOffer(
	ctx: MutationCtx,
	token: string,
): Promise<{ offer: Doc<"companyApplicationOffers">; application: Doc<"companyApplications"> }> {
	const offer = await findOfferByToken(ctx, token);
	const application = offer ? await ctx.db.get(offer.applicationId) : null;
	if (!offer || !application) throw new ConvexError("Fant ikke tilbudet.");

	if (
		offer.status === "superseded" ||
		application.status === "withdrawn" ||
		application.status === "rejected"
	) {
		throw new ConvexError("Tilbudet gjelder ikke lenger.");
	}

	return { offer, application };
}

/** Where companies answer an offer. The token is the only credential. */
export function offerUrl(token: string): string {
	return `https://hugin.ifinavet.no/bestill-bedpres/tilbud/${token}`;
}

/** Who hears about company answers: SEMESTER_PLANNING_NOTIFY_EMAIL, or bedrift@ifinavet.no. */
export function notifyAddress(): string {
	return process.env.SEMESTER_PLANNING_NOTIFY_EMAIL || "bedrift@ifinavet.no";
}
