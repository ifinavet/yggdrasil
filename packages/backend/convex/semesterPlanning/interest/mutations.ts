import { companyInterestSchema } from "@workspace/shared/semester/interest";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, internalQuery, mutation } from "../../_generated/server";
import { rateLimiter } from "../rateLimits";

/**
 * «Gi oss beskjed» on Hugin while no semester takes applications: emails Navet at
 * bedrift@ifinavet.no that a company wants to know when applications open. Public and
 * unauthenticated, so it checks the answers again and rate limits per email address. The company
 * is kept until applications open and it has been told, once per email address.
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
			throw new ConvexError(
				"Det har kommet mange henvendelser på kort tid. Vent litt, og prøv igjen om en stund.",
			);
		}

		const email = parsed.data.email.toLowerCase();
		const existing = await ctx.db
			.query("companyInterest")
			.withIndex("by_email", (q) => q.eq("email", email))
			.first();
		if (existing) await ctx.db.patch(existing._id, { companyName: parsed.data.companyName });
		else await ctx.db.insert("companyInterest", { companyName: parsed.data.companyName, email });

		await ctx.scheduler.runAfter(
			0,
			internal.semesterPlanning.interest.emails.sendInterestEmail,
			parsed.data,
		);
		return null;
	},
});

// Navet hears from far fewer companies than this between two semesters.
const MAX_INTERESTED = 500;

/**
 * The companies to tell that the semester's applications are open, with what the email says.
 *
 * @param {Id<"semesters">} semesterId - The semester that just opened.
 *
 * @returns {object | null} - The semester and the companies, or null when it is not open.
 */
export const forOpening = internalQuery({
	args: { semesterId: v.id("semesters") },
	returns: v.union(
		v.null(),
		v.object({
			term: v.union(v.literal("spring"), v.literal("autumn")),
			year: v.number(),
			applicationDeadline: v.string(),
			companies: v.array(
				v.object({
					_id: v.id("companyInterest"),
					companyName: v.string(),
					email: v.string(),
				}),
			),
		}),
	),
	handler: async (ctx, { semesterId }) => {
		const semester = await ctx.db.get(semesterId);
		if (semester?.status !== "open" || !semester.applicationDeadline) return null;
		const companies = await ctx.db.query("companyInterest").take(MAX_INTERESTED);
		return {
			term: semester.term,
			year: semester.year,
			applicationDeadline: semester.applicationDeadline,
			companies: companies.map(({ _id, companyName, email }) => ({ _id, companyName, email })),
		};
	},
});

/** Forgets the companies that have been told applications are open. */
export const forget = internalMutation({
	args: { ids: v.array(v.id("companyInterest")) },
	returns: v.null(),
	handler: async (ctx, { ids }) => {
		for (const id of ids) if (await ctx.db.get(id)) await ctx.db.delete(id);
		return null;
	},
});
