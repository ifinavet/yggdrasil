import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/** Spring comes before autumn in the same year. */
export function semesterSortKey(semester: Pick<Doc<"semesters">, "year" | "term">): number {
	return semester.year * 2 + (semester.term === "autumn" ? 1 : 0);
}

/**
 * Reads a semester or throws a Norwegian not-found error.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"semesters">} semesterId - The semester to read.
 *
 * @throws - An error if the semester does not exist.
 * @returns {Promise<Doc<"semesters">>} - The semester.
 */
export async function requireSemester(
	ctx: QueryCtx | MutationCtx,
	semesterId: Id<"semesters">,
): Promise<Doc<"semesters">> {
	const semester = await ctx.db.get(semesterId);
	if (!semester) throw new ConvexError("Semesteret ble ikke funnet.");
	return semester;
}

/**
 * Lists a semester's dates in calendar order.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {Id<"semesters">} semesterId - The semester whose dates to list.
 *
 * @returns {Promise<Doc<"semesterDates">[]>} - The dates, earliest first.
 */
export async function listSemesterDates(
	ctx: QueryCtx | MutationCtx,
	semesterId: Id<"semesters">,
): Promise<Doc<"semesterDates">[]> {
	return ctx.db
		.query("semesterDates")
		.withIndex("by_semesterId_and_date", (q) => q.eq("semesterId", semesterId))
		.collect();
}

/**
 * Finds the semester for a year and term, if it exists.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex query or mutation context.
 * @param {number} year - The year.
 * @param {Doc<"semesters">["term"]} term - Spring or autumn.
 *
 * @returns {Promise<Doc<"semesters"> | null>} - The semester, or null.
 */
export async function findSemester(
	ctx: QueryCtx | MutationCtx,
	year: number,
	term: Doc<"semesters">["term"],
): Promise<Doc<"semesters"> | null> {
	return ctx.db
		.query("semesters")
		.withIndex("by_year_and_term", (q) => q.eq("year", year).eq("term", term))
		.first();
}

/**
 * The settings a new semester inherits from the most recent one: information text, terms link
 * and reply time. Dates and deadlines are never inherited; a human sets those.
 *
 * @param {MutationCtx} ctx - The Convex mutation context.
 *
 * @returns {Promise<Pick<Doc<"semesters">, "infoText" | "termsUrl" | "offerResponseDays">>} - The copied settings.
 */
export async function settingsFromLatestSemester(
	ctx: MutationCtx,
): Promise<Pick<Doc<"semesters">, "infoText" | "termsUrl" | "offerResponseDays">> {
	// The index sorts terms alphabetically, so read the newest few and order them properly.
	const newest = await ctx.db
		.query("semesters")
		.withIndex("by_year_and_term")
		.order("desc")
		.take(3);
	const latest = newest.sort((a, b) => semesterSortKey(b) - semesterSortKey(a))[0];
	if (!latest) return {};

	return {
		...(latest.infoText !== undefined ? { infoText: latest.infoText } : {}),
		...(latest.termsUrl !== undefined ? { termsUrl: latest.termsUrl } : {}),
		...(latest.offerResponseDays !== undefined
			? { offerResponseDays: latest.offerResponseDays }
			: {}),
	};
}
