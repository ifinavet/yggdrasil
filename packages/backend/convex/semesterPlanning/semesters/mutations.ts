import { semesterName } from "@workspace/shared/semester/labels";
import {
	MAX_OFFER_RESPONSE_DAYS,
	MAX_SEMESTER_YEAR,
	MIN_OFFER_RESPONSE_DAYS,
	MIN_SEMESTER_YEAR,
} from "@workspace/shared/semester/limits";
import {
	isIsoDate,
	nextTermAfter,
	osloToday,
	presentationDaysBetween,
} from "@workspace/shared/time";
import { isHttpUrl } from "@workspace/shared/utils";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../../_generated/server";
import { editorRoles, requireRole } from "../../auth/accessRights";
import { findActiveApplicationOnDate } from "../applicationLifecycle";
import { applicationPeriodStatus, semesterTerm } from "../schema";
import {
	findSemester,
	listSemesterDates,
	requireSemester,
	settingsFromLatestSemester,
} from "./helper";

function requireIsoDate(value: string, label: string): void {
	if (!isIsoDate(value)) throw new ConvexError(`${label} må være en gyldig dato (ÅÅÅÅ-MM-DD).`);
}

function refuseIfSemesterClosed(semester: Doc<"semesters">): void {
	if (semester.status === "closed") {
		throw new ConvexError("Semesteret er stengt og kan ikke endres.");
	}
}

async function insertDraftSemester(
	ctx: MutationCtx,
	year: number,
	term: Doc<"semesters">["term"],
): Promise<Id<"semesters">> {
	return ctx.db.insert("semesters", {
		year,
		term,
		status: "draft",
		...(await settingsFromLatestSemester(ctx)),
	});
}

/**
 * Creates a draft semester. Settings (information text, terms link and reply time) are copied from
 * the most recent semester; the dates and the deadline are set afterwards.
 *
 * @param {number} year - The year.
 * @param {"spring" | "autumn"} term - The term.
 *
 * @throws - An error if the caller is not an editor, or the semester already exists.
 * @returns {Id<"semesters">} - The id of the new semester.
 */
export const create = mutation({
	args: { year: v.number(), term: semesterTerm },
	returns: v.id("semesters"),
	handler: async (ctx, { year, term }) => {
		await requireRole(ctx, editorRoles);

		if (!Number.isInteger(year) || year < MIN_SEMESTER_YEAR || year > MAX_SEMESTER_YEAR) {
			throw new ConvexError("Oppgi et gyldig år.");
		}
		if (await findSemester(ctx, year, term)) {
			throw new ConvexError(`${semesterName(term, year)} finnes allerede.`);
		}

		return insertDraftSemester(ctx, year, term);
	},
});

/**
 * Sets the first and last date of a semester and generates its Tuesdays and Thursdays. Dates that
 * stay in the range keep their closed label; dates that fall out of it are removed, unless a
 * company has been given one.
 *
 * @param {Id<"semesters">} semesterId - The semester to update.
 * @param {string} firstDate - The first day, as YYYY-MM-DD.
 * @param {string} lastDate - The last day, as YYYY-MM-DD.
 *
 * @throws - An error if the caller is not an editor, the range is invalid, the semester is closed,
 * or a removed date is assigned to a company.
 * @returns {null} - Returns null when the dates are updated.
 */
export const setRange = mutation({
	args: { semesterId: v.id("semesters"), firstDate: v.string(), lastDate: v.string() },
	returns: v.null(),
	handler: async (ctx, { semesterId, firstDate, lastDate }) => {
		await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		refuseIfSemesterClosed(semester);
		requireIsoDate(firstDate, "Første dato");
		requireIsoDate(lastDate, "Siste dato");
		if (firstDate > lastDate) {
			throw new ConvexError("Første dato må være før siste dato.");
		}

		const wanted = new Set(presentationDaysBetween(firstDate, lastDate));
		if (wanted.size === 0) {
			throw new ConvexError("Perioden har ingen tirsdager eller torsdager.");
		}

		const existing = await listSemesterDates(ctx, semesterId);
		const removed = existing.filter((date) => !wanted.has(date.date));
		for (const date of removed) {
			const holder = await findActiveApplicationOnDate(ctx, semesterId, date.date);
			if (holder) {
				throw new ConvexError(
					`${date.date} er tildelt ${holder.registry.name}. Flytt søknaden før du endrer perioden.`,
				);
			}
		}

		const kept = new Set(existing.map((date) => date.date));
		await Promise.all(removed.map((date) => ctx.db.delete(date._id)));
		await Promise.all(
			[...wanted]
				.filter((date) => !kept.has(date))
				.map((date) => ctx.db.insert("semesterDates", { semesterId, date })),
		);
		await ctx.db.patch(semesterId, { firstDate, lastDate });

		return null;
	},
});

/**
 * Updates the application deadline and the texts companies see. An empty string clears a text.
 *
 * @param {Id<"semesters">} semesterId - The semester to update.
 * @param {string} [applicationDeadline] - The deadline, as YYYY-MM-DD.
 * @param {string} [infoText] - Information shown to companies.
 * @param {string} [termsUrl] - Link to the standard terms.
 * @param {number} [offerResponseDays] - How many days a company has to answer an offer.
 *
 * @throws - An error if the caller is not an editor, a value is invalid, or the semester is closed.
 * @returns {null} - Returns null when the settings are saved.
 */
export const updateSettings = mutation({
	args: {
		semesterId: v.id("semesters"),
		applicationDeadline: v.optional(v.string()),
		infoText: v.optional(v.string()),
		termsUrl: v.optional(v.string()),
		offerResponseDays: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (
		ctx,
		{ semesterId, applicationDeadline, infoText, termsUrl, offerResponseDays },
	) => {
		await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		refuseIfSemesterClosed(semester);

		if (applicationDeadline !== undefined) requireIsoDate(applicationDeadline, "Søknadsfristen");
		if (termsUrl !== undefined && termsUrl !== "" && !isHttpUrl(termsUrl)) {
			throw new ConvexError("Lenken til standardvilkårene er ugyldig.");
		}
		if (
			offerResponseDays !== undefined &&
			(!Number.isInteger(offerResponseDays) ||
				offerResponseDays < MIN_OFFER_RESPONSE_DAYS ||
				offerResponseDays > MAX_OFFER_RESPONSE_DAYS)
		) {
			throw new ConvexError(
				`Svarfristen må være mellom ${MIN_OFFER_RESPONSE_DAYS} og ${MAX_OFFER_RESPONSE_DAYS} dager.`,
			);
		}

		const text = (value: string | undefined) => (value === "" ? undefined : value);
		await ctx.db.patch(semesterId, {
			...(applicationDeadline !== undefined ? { applicationDeadline } : {}),
			...(infoText !== undefined ? { infoText: text(infoText) } : {}),
			...(termsUrl !== undefined ? { termsUrl: text(termsUrl) } : {}),
			...(offerResponseDays !== undefined ? { offerResponseDays } : {}),
		});

		return null;
	},
});

/**
 * Closes a date with a reason (e.g. «Kickoff»), or opens it again with a null label. A date that
 * is assigned to a company cannot be closed.
 *
 * @param {Id<"semesterDates">} dateId - The date to close or open.
 * @param {string | null} label - Why Navet uses the date, or null to open it.
 *
 * @throws - An error if the caller is not an editor, the label is empty, or the date is assigned.
 * @returns {null} - Returns null when the date is updated.
 */
export const setDateClosed = mutation({
	args: { dateId: v.id("semesterDates"), label: v.union(v.string(), v.null()) },
	returns: v.null(),
	handler: async (ctx, { dateId, label }) => {
		await requireRole(ctx, editorRoles);

		const date = await ctx.db.get(dateId);
		if (!date) throw new ConvexError("Datoen ble ikke funnet.");
		refuseIfSemesterClosed(await requireSemester(ctx, date.semesterId));

		if (label === null) {
			await ctx.db.patch(dateId, { closedLabel: undefined });
			return null;
		}

		const trimmed = label.trim();
		if (!trimmed) throw new ConvexError("Skriv hvorfor datoen er stengt.");

		const holder = await findActiveApplicationOnDate(ctx, date.semesterId, date.date);
		if (holder) {
			throw new ConvexError(`Datoen er tildelt ${holder.registry.name}. Flytt søknaden først.`);
		}

		await ctx.db.patch(dateId, { closedLabel: trimmed });
		return null;
	},
});

/**
 * Moves a semester between draft, open and closed. Opening requires dates and a deadline, and
 * only one semester can be open at a time.
 *
 * @param {Id<"semesters">} semesterId - The semester to update.
 * @param {"draft" | "open" | "closed"} status - The new status.
 *
 * @throws - An error if the caller is not an editor, or the semester is not ready to open.
 * @returns {null} - Returns null when the status is changed.
 */
export const setStatus = mutation({
	args: { semesterId: v.id("semesters"), status: applicationPeriodStatus },
	returns: v.null(),
	handler: async (ctx, { semesterId, status }) => {
		await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		if (status === "open") {
			if (!semester.firstDate || !semester.lastDate || !semester.applicationDeadline) {
				throw new ConvexError(
					"Sett første dato, siste dato og søknadsfrist før du åpner semesteret.",
				);
			}
			const openDates = (await listSemesterDates(ctx, semesterId)).filter(
				(date) => date.closedLabel === undefined,
			);
			if (openDates.length === 0) {
				throw new ConvexError("Semesteret har ingen åpne datoer.");
			}
			const alreadyOpen = await ctx.db
				.query("semesters")
				.withIndex("by_status", (q) => q.eq("status", "open"))
				.collect();
			const other = alreadyOpen.find((open) => open._id !== semesterId);
			if (other) {
				throw new ConvexError(
					`${semesterName(other.term, other.year)} er allerede åpent. Steng det først.`,
				);
			}
			// The rollover job would close it again the next night.
			if (semester.lastDate < osloToday(Date.now())) {
				throw new ConvexError("Semesteret er over og kan ikke åpnes.");
			}
		}

		await ctx.db.patch(semesterId, { status });
		return null;
	},
});

/**
 * Marks the semester plan as finished. Doing it again keeps the first time and person.
 *
 * @param {Id<"semesters">} semesterId - The semester to finalize.
 *
 * @throws - An error if the caller is not an editor.
 * @returns {null} - Returns null when the plan is marked as finished.
 */
export const finalizePlan = mutation({
	args: { semesterId: v.id("semesters") },
	returns: v.null(),
	handler: async (ctx, { semesterId }) => {
		const user = await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		if (semester.planFinalizedAt === undefined) {
			await ctx.db.patch(semesterId, { planFinalizedAt: Date.now(), planFinalizedBy: user._id });
		}

		return null;
	},
});

/**
 * Rollover job. Makes sure next semester exists as a draft (year and term only, with settings
 * copied from the latest semester), and closes open semesters whose last date has passed. It never
 * sets dates or deadlines and never opens a semester, so running it twice or late is harmless.
 *
 * @param {number} [now] - The current time, for tests. Defaults to Date.now().
 *
 * @returns {{ createdSemesterId: Id<"semesters"> | null, closedSemesters: number }} - What changed.
 */
export const rolloverSemesters = internalMutation({
	args: { now: v.optional(v.number()) },
	returns: v.object({
		createdSemesterId: v.union(v.id("semesters"), v.null()),
		closedSemesters: v.number(),
	}),
	handler: async (ctx, { now }) => {
		const today = osloToday(now ?? Date.now());
		const next = nextTermAfter(today);

		const createdSemesterId = (await findSemester(ctx, next.year, next.term))
			? null
			: await insertDraftSemester(ctx, next.year, next.term);

		const open = await ctx.db
			.query("semesters")
			.withIndex("by_status", (q) => q.eq("status", "open"))
			.collect();
		const finished = open.filter((semester) => semester.lastDate && semester.lastDate < today);
		await Promise.all(finished.map((semester) => ctx.db.patch(semester._id, { status: "closed" })));

		return { createdSemesterId, closedSemesters: finished.length };
	},
});
