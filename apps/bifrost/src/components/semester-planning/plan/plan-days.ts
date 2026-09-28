import type { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { type ApplicationStatus, closedDateLabel } from "@workspace/shared/semester/labels";
import type { FunctionReturnType } from "convex/server";
import { isActiveStatus } from "../status";

export type PlanRow = FunctionReturnType<
	typeof api.semesterPlanning.applications.queries.getPlan
>[number];

/** An event an editor put in the plan, by hand or from the calendar. */
export type PlanEventRow = FunctionReturnType<
	typeof api.semesterPlanning.planEvents.queries.listForSemester
>[number];

/** What only editors see on a plan row: organization number and the company's contact person. */
export type EditorDetails = Pick<Doc<"companyApplications">, "orgNumber" | "contact">;

/**
 * One line in the plan: a semester date closed by Navet, free, or held by an application, or an
 * event added to the plan. An event on a day without a semester date (not a Tuesday or Thursday)
 * is an `extraDay`.
 */
export type PlanDay =
	| { kind: "closed"; date: string; label: string }
	| { kind: "free"; date: string }
	| { kind: "assigned"; date: string; row: PlanRow; details?: EditorDetails }
	| { kind: "event"; date: string; event: PlanEventRow; extraDay: boolean };

/** The active applications by the date they hold, and the events their applications made. */
function indexRows(rows: readonly PlanRow[]) {
	const byDate = new Map<string, PlanRow>();
	const applicationEvents = new Set<Id<"events">>();
	for (const row of rows) {
		if (!isActiveStatus(row.status)) continue;
		if (row.assignedDate) byDate.set(row.assignedDate, row);
		if (row.eventId) applicationEvents.add(row.eventId);
	}
	return { byDate, applicationEvents };
}

/** The plan's events by day, leaving out those an assigned application already shows. */
function groupEventsByDate(events: readonly PlanEventRow[], skip: ReadonlySet<Id<"events">>) {
	const byDate = new Map<string, PlanEventRow[]>();
	for (const event of events) {
		if (skip.has(event.eventId)) continue;
		byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
	}
	return byDate;
}

/** The day for a semester date: closed, held, or free unless an event stands in its place. */
function semesterDateDay(
	semesterDate: Doc<"semesterDates">,
	row: PlanRow | undefined,
	details: EditorDetails | undefined,
	hasEvents: boolean,
): PlanDay | null {
	const { date, closedLabel } = semesterDate;
	if (closedLabel !== undefined) {
		return { kind: "closed", date, label: closedDateLabel(closedLabel) };
	}
	if (row) return { kind: "assigned", date, row, details };
	return hasEvents ? null : { kind: "free", date };
}

/**
 * Builds the plan in calendar order: one day per semester date, plus the events in the plan on
 * their own days. An event on a free date takes its place; on a closed or held date it is shown
 * after it, so a clash is visible. An event that belongs to an assigned application is left out,
 * since its application row already shows it.
 */
export function buildPlanDays(
	dates: readonly Doc<"semesterDates">[],
	rows: readonly PlanRow[],
	editorApplications: readonly Doc<"companyApplications">[] | undefined,
	events: readonly PlanEventRow[] = [],
): PlanDay[] {
	const { byDate, applicationEvents } = indexRows(rows);
	const details = new Map<Id<"companyApplications">, EditorDetails>(
		(editorApplications ?? []).map((application) => [application._id, application]),
	);
	const eventsByDate = groupEventsByDate(events, applicationEvents);
	const semesterDates = new Map(dates.map((date) => [date.date, date]));
	// ISO days sort as text.
	const allDates = [...new Set([...semesterDates.keys(), ...eventsByDate.keys()])].sort((a, b) =>
		a.localeCompare(b),
	);

	return allDates.flatMap((date) => {
		const semesterDate = semesterDates.get(date);
		const dayEvents = eventsByDate.get(date) ?? [];
		const row = byDate.get(date);
		const day =
			semesterDate &&
			semesterDateDay(semesterDate, row, row && details.get(row._id), dayEvents.length > 0);
		return [
			...(day ? [day] : []),
			...dayEvents.map(
				(event): PlanDay => ({ kind: "event", date, event, extraDay: !semesterDate }),
			),
		];
	});
}

export type PlanFilter = {
	status: ApplicationStatus | "all";
	/** A user id, "none" for rows without a kontaktperson from Navet, or "all". */
	responsible: string;
};

export const NO_FILTER: PlanFilter = { status: "all", responsible: "all" };

/** Whether a row's kontaktperson from Navet passes the filter. */
function matchesResponsible(responsibleUserId: string | undefined, filter: PlanFilter): boolean {
	if (filter.responsible === "none") return responsibleUserId === undefined;
	return filter.responsible === "all" || responsibleUserId === filter.responsible;
}

/**
 * Applies the status and kontaktperson filters. With a filter set, only the matching assigned
 * dates and events remain; free and closed dates are only shown for the whole plan. Events have no
 * application status, so a status filter leaves them out.
 */
export function filterPlanDays(days: readonly PlanDay[], filter: PlanFilter): PlanDay[] {
	if (filter.status === "all" && filter.responsible === "all") return [...days];
	return days.filter((day) => {
		if (day.kind === "event") {
			return filter.status === "all" && matchesResponsible(day.event.responsibleUserId, filter);
		}
		if (day.kind !== "assigned") return false;
		if (filter.status !== "all" && day.row.status !== filter.status) return false;
		return matchesResponsible(day.row.responsibleUserId, filter);
	});
}
