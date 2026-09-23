import { v } from "convex/values";
import { query } from "../../_generated/server";
import { internalRoles, requireRole } from "../../auth/accessRights";
import schema from "../../schema";
import { semesterTerm } from "../schema";
import { listSemesterDates, requireSemester, semesterSortKey } from "./helper";

// Two semesters a year; this covers 50 years of history.
const MAX_SEMESTERS = 100;

/**
 * Fetches the semester that is open for applications, for Hugin and Midgard. Public: it returns
 * only the open dates and the texts companies need, and nothing about other applications.
 *
 * @returns {object | null} - The open semester, or null when applications are closed.
 */
export const getOpenForApplications = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("semesters"),
			year: v.number(),
			term: semesterTerm,
			applicationDeadline: v.string(),
			infoText: v.optional(v.string()),
			termsUrl: v.optional(v.string()),
			dates: v.array(v.string()),
		}),
	),
	handler: async (ctx) => {
		const semester = await ctx.db
			.query("semesters")
			.withIndex("by_status", (q) => q.eq("status", "open"))
			.first();
		if (!semester?.applicationDeadline) return null;

		const dates = await listSemesterDates(ctx, semester._id);

		return {
			_id: semester._id,
			year: semester.year,
			term: semester.term,
			applicationDeadline: semester.applicationDeadline,
			...(semester.infoText !== undefined ? { infoText: semester.infoText } : {}),
			...(semester.termsUrl !== undefined ? { termsUrl: semester.termsUrl } : {}),
			dates: dates.filter((date) => date.closedLabel === undefined).map((date) => date.date),
		};
	},
});

/**
 * Lists every semester, newest first.
 *
 * @throws - An error if the caller is not an internal member.
 * @returns {Doc<"semesters">[]} - The semesters.
 */
export const list = query({
	args: {},
	returns: v.array(schema.doc("semesters")),
	handler: async (ctx) => {
		await requireRole(ctx, internalRoles);

		const semesters = await ctx.db
			.query("semesters")
			.withIndex("by_year_and_term")
			.order("desc")
			.take(MAX_SEMESTERS);
		return semesters.sort((a, b) => semesterSortKey(b) - semesterSortKey(a));
	},
});

/**
 * Fetches a semester with all its dates, including closed ones.
 *
 * @param {Id<"semesters">} semesterId - The semester to fetch.
 *
 * @throws - An error if the caller is not an internal member, or the semester does not exist.
 * @returns {{ semester: Doc<"semesters">, dates: Doc<"semesterDates">[] }} - The semester and its dates.
 */
export const get = query({
	args: { semesterId: v.id("semesters") },
	returns: v.object({
		semester: schema.doc("semesters"),
		dates: v.array(schema.doc("semesterDates")),
	}),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, internalRoles);

		const semester = await requireSemester(ctx, semesterId);
		const dates = await listSemesterDates(ctx, semesterId);

		return { semester, dates };
	},
});
