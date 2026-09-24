import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { LINK_TOKEN_LENGTH } from "../../lib/tokens";

/**
 * Finds the offer behind a link token.
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
	if (token.length !== LINK_TOKEN_LENGTH) return null;

	return ctx.db
		.query("companyApplicationOffers")
		.withIndex("by_linkToken", (q) => q.eq("linkToken", token))
		.unique();
}

/**
 * The offer sent last on an application, which is the only one a company can still answer.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"companyApplications">} applicationId - The application.
 *
 * @returns {Promise<Doc<"companyApplicationOffers"> | null>} - The newest offer, or null if none was sent.
 */
export async function findLatestOffer(
	ctx: QueryCtx | MutationCtx,
	applicationId: Id<"companyApplications">,
): Promise<Doc<"companyApplicationOffers"> | null> {
	return ctx.db
		.query("companyApplicationOffers")
		.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
		.order("desc")
		.first();
}

/**
 * Loads the application behind an offer a company is answering, and refuses links that are
 * unknown, replaced by a newer offer, or belong to a withdrawn or rejected application. Unknown
 * and replaced links get messages that reveal nothing about other offers.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Doc<"companyApplicationOffers"> | null} offer - The offer found from the link, if any.
 *
 * @throws - A Norwegian error when the link cannot be answered.
 * @returns {Promise<{ offer: Doc<"companyApplicationOffers">, application: Doc<"companyApplications"> }>} - The offer and application.
 */
export async function requireAnswerableOffer(
	ctx: MutationCtx,
	offer: Doc<"companyApplicationOffers"> | null,
): Promise<{ offer: Doc<"companyApplicationOffers">; application: Doc<"companyApplications"> }> {
	const application = offer ? await ctx.db.get(offer.applicationId) : null;
	if (!offer || !application) throw new ConvexError("Fant ikke tilbudet.");

	const latest = await findLatestOffer(ctx, application._id);
	if (
		offer.status === "superseded" ||
		latest?._id !== offer._id ||
		application.status === "withdrawn" ||
		application.status === "rejected"
	) {
		throw new ConvexError("Tilbudet gjelder ikke lenger.");
	}

	return { offer, application };
}

/**
 * Marks every pending offer on an application as superseded, so their links stop working.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 * @param {Id<"companyApplications">} applicationId - The application whose offers to close.
 *
 * @returns {Promise<number>} - How many offers were superseded.
 */
export async function supersedePendingOffers(
	ctx: MutationCtx,
	applicationId: Id<"companyApplications">,
): Promise<number> {
	const offers = await ctx.db
		.query("companyApplicationOffers")
		.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
		.collect();

	const pending = offers.filter((offer) => offer.status === "pending");
	await Promise.all(pending.map((offer) => ctx.db.patch(offer._id, { status: "superseded" })));

	return pending.length;
}
