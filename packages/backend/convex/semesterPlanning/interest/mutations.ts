import { companyInterestSchema } from "@workspace/shared/semester/interest";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { rateLimiter } from "../rateLimits";

/**
 * «Gi oss beskjed» on Hugin while no semester takes applications: emails Navet at
 * bedrift@ifinavet.no that a company wants to know when applications open. Public and
 * unauthenticated, so it checks the answers again and rate limits per email address. Nothing is
 * stored; the email is the record.
 *
 * @param {string} companyName - The company's name.
 * @param {string} email - Where Navet can reach the company.
 * @param {string} [website] - A hidden honeypot field; bots fill it in, people don't.
 *
 * @throws - A Norwegian error when the answers are not valid, or too many have been sent.
 * @returns {null} - Always null.
 */
export const register = mutation({
	args: { companyName: v.string(), email: v.string(), website: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { website, ...answers }) => {
		// Answer a filled-in honeypot like a success, so bots learn nothing.
		if (website?.trim()) return null;

		const parsed = companyInterestSchema.safeParse(answers);
		if (!parsed.success) {
			throw new ConvexError(parsed.error.issues[0]?.message ?? "Skjemaet er ikke gyldig.");
		}

		const perEmail = await rateLimiter.limit(ctx, "registerInterest", {
			key: parsed.data.email.toLowerCase(),
		});
		const overall = await rateLimiter.limit(ctx, "registerInterestGlobal");
		if (!perEmail.ok || !overall.ok) {
			throw new ConvexError("Det er sendt mange på kort tid. Prøv igjen senere.");
		}

		await ctx.scheduler.runAfter(
			0,
			internal.semesterPlanning.interest.emails.sendInterestEmail,
			parsed.data,
		);
		return null;
	},
});
