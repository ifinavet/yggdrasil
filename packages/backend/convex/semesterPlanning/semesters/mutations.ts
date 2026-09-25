import { semesterName } from "@workspace/shared/semester/labels";
import { MAX_SEMESTER_YEAR, MIN_SEMESTER_YEAR } from "@workspace/shared/semester/limits";
import {
	isClockTime,
	isIsoDate,
	nextTermAfter,
	osloToday,
	presentationDaysBetween,
} from "@workspace/shared/semester/time";
import { isHttpUrl } from "@workspace/shared/utils";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../../_generated/server";
import { editorRoles, requireRole } from "../../auth/accessRights";
import { findActiveApplicationOnDate, requireEditorActor } from "../applicationLifecycle";
import { findCompanyProfile, listApplicationsInSemester } from "../applications/helper";
import { ensureDraftEvent } from "../events";
import { isUnsettledApplicationStatus } from "../rules";
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
 * Creates a draft semester. Settings (information text, terms link and event start time) are
 * copied from the most recent semester; the dates and the deadline are set afterwards.
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
 * Updates the application deadline, the texts companies see and when events made from the plan
 * start. An empty string clears a text or the start time.
 *
 * @param {Id<"semesters">} semesterId - The semester to update.
 * @param {string} [applicationDeadline] - The deadline, as YYYY-MM-DD.
 * @param {boolean} [hardDeadline] - Whether Hugin stops taking applications after the deadline.
 * @param {string} [infoText] - Information shown to companies.
 * @param {string} [termsUrl] - Link to the standard terms.
 * @param {string} [defaultEventStartTime] - When events made from the plan start, as HH:mm.
 *
 * @throws - An error if the caller is not an editor, a value is invalid, or the semester is closed.
 * @returns {null} - Returns null when the settings are saved.
 */
export const updateSettings = mutation({
	args: {
		semesterId: v.id("semesters"),
		applicationDeadline: v.optional(v.string()),
		hardDeadline: v.optional(v.boolean()),
		infoText: v.optional(v.string()),
		termsUrl: v.optional(v.string()),
		defaultEventStartTime: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (
		ctx,
		{ semesterId, applicationDeadline, hardDeadline, infoText, termsUrl, defaultEventStartTime },
	) => {
		await requireRole(ctx, editorRoles);

		const semester = await requireSemester(ctx, semesterId);
		refuseIfSemesterClosed(semester);

		if (applicationDeadline !== undefined) requireIsoDate(applicationDeadline, "Søknadsfristen");
		if (termsUrl !== undefined && termsUrl !== "" && !isHttpUrl(termsUrl)) {
			throw new ConvexError("Lenken til standardvilkårene er ugyldig.");
		}
		if (defaultEventStartTime && !isClockTime(defaultEventStartTime)) {
			throw new ConvexError("Starttiden må være et gyldig klokkeslett (TT:MM).");
		}

		const text = (value: string | undefined) => (value === "" ? undefined : value);
		await ctx.db.patch(semesterId, {
			...(applicationDeadline !== undefined ? { applicationDeadline } : {}),
			...(hardDeadline !== undefined ? { hardDeadline } : {}),
			...(infoText !== undefined ? { infoText: text(infoText) } : {}),
			...(termsUrl !== undefined ? { termsUrl: text(termsUrl) } : {}),
			...(defaultEventStartTime !== undefined
				? { defaultEventStartTime: text(defaultEventStartTime) }
				: {}),
		});

		return null;
	},
});

/**
 * Closes a date, with an optional reason (e.g. «Kickoff»), or opens it again with a null label.
 * A date closed without a reason stores an empty label, so closed always means a label is set. A
 * date that is assigned to a company cannot be closed.
 *
 * @param {Id<"semesterDates">} dateId - The date to close or open.
 * @param {string | null} label - Why Navet uses the date (may be empty), or null to open it.
 *
 * @throws - An error if the caller is not an editor, or the date is assigned.
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

		const holder = await findActiveApplicationOnDate(ctx, date.semesterId, date.date);
		if (holder) {
			throw new ConvexError(`Datoen er tildelt ${holder.registry.name}. Flytt søknaden først.`);
		}

		await ctx.db.patch(dateId, { closedLabel: label.trim() });
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
 * Marks the semester plan as finished, once no application waits for an offer or an answer, and
 * makes sure every confirmed application has its unpublished draft event. Doing it again keeps the
 * first time and person, and only moves drafts whose date changed. An application that needs an
 * offer or answer again reopens the plan.
 *
 * A company without a profile in Bifrost is skipped and named in the result. Any other problem,
 * such as an invalid medhjelper, refuses the whole run with the company's name, so no events are
 * made until it is fixed.
 *
 * @param {Id<"semesters">} semesterId - The semester to finalize.
 *
 * @throws - An error if the caller is not an editor, applications still wait, the semester has no
 * start time for events, or an event cannot be made.
 * @returns {{ created: number, missingProfile: string[] }} - How many events were made, and the
 * companies skipped for lack of a profile.
 */
export const finalizePlan = mutation({
	args: { semesterId: v.id("semesters") },
	returns: v.object({ created: v.number(), missingProfile: v.array(v.string()) }),
	handler: async (ctx, { semesterId }) => {
		const actor = await requireEditorActor(ctx);

		const semester = await requireSemester(ctx, semesterId);
		const applications = await listApplicationsInSemester(ctx, semesterId);
		const waiting = applications.filter((application) =>
			isUnsettledApplicationStatus(application.status),
		).length;
		if (waiting > 0) {
			throw new ConvexError(
				`${waiting} ${waiting === 1 ? "søknad venter" : "søknader venter"} fortsatt på tilbud eller svar.`,
			);
		}
		if (!semester.defaultEventStartTime) {
			throw new ConvexError("Sett starttid for arrangementer i innstillingene først.");
		}

		let created = 0;
		const missingProfile: string[] = [];
		for (const application of applications.filter(({ status }) => status === "confirmed")) {
			const { name } = application.registry;
			if (!application.eventId && !(await findCompanyProfile(ctx, application))) {
				missingProfile.push(name);
				continue;
			}
			try {
				if ((await ensureDraftEvent(ctx, application, actor)) !== application.eventId) created++;
			} catch (error) {
				if (error instanceof ConvexError) throw new ConvexError(`${name}: ${error.data}`);
				throw error;
			}
		}

		if (semester.planFinalizedAt === undefined) {
			await ctx.db.patch(semesterId, {
				planFinalizedAt: Date.now(),
				planFinalizedBy: actor.userId,
			});
		}

		return { created, missingProfile };
	},
});

/**
 * Marks the semester plan as not finished, so it can be changed and finished again.
 *
 * @param {Id<"semesters">} semesterId - The semester.
 *
 * @throws - An error if the caller is not an editor.
 * @returns {null} - Returns null when the plan is no longer finished.
 */
export const unfinalizePlan = mutation({
	args: { semesterId: v.id("semesters") },
	returns: v.null(),
	handler: async (ctx, { semesterId }) => {
		await requireRole(ctx, editorRoles);
		await requireSemester(ctx, semesterId);

		await ctx.db.patch(semesterId, { planFinalizedAt: undefined, planFinalizedBy: undefined });
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
