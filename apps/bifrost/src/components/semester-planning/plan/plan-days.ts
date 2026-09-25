import type { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { type ApplicationStatus, closedDateLabel } from "@workspace/shared/semester/labels";
import type { FunctionReturnType } from "convex/server";
import { isActiveStatus } from "../status";

export type PlanRow = FunctionReturnType<
	typeof api.semesterPlanning.applications.queries.getPlan
>[number];

/** What only editors see on a plan row: organization number and the company's contact person. */
export type EditorDetails = Pick<Doc<"companyApplications">, "orgNumber" | "contact">;

/** One semester date in the plan: closed by Navet, free, or held by an application. */
export type PlanDay =
	| { kind: "closed"; date: string; label: string }
	| { kind: "free"; date: string }
	| { kind: "assigned"; date: string; row: PlanRow; details?: EditorDetails };

/** Builds one plan day per semester date, in calendar order. */
export function buildPlanDays(
	dates: readonly Doc<"semesterDates">[],
	rows: readonly PlanRow[],
	editorApplications: readonly Doc<"companyApplications">[] | undefined,
): PlanDay[] {
	const byDate = new Map<string, PlanRow>();
	for (const row of rows) {
		if (row.assignedDate && isActiveStatus(row.status)) byDate.set(row.assignedDate, row);
	}
	const details = new Map<Id<"companyApplications">, EditorDetails>(
		(editorApplications ?? []).map((application) => [application._id, application]),
	);

	return dates.map(({ date, closedLabel }): PlanDay => {
		if (closedLabel !== undefined)
			return { kind: "closed", date, label: closedDateLabel(closedLabel) };
		const row = byDate.get(date);
		if (!row) return { kind: "free", date };
		return { kind: "assigned", date, row, details: details.get(row._id) };
	});
}

export type PlanFilter = {
	status: ApplicationStatus | "all";
	/** A user id, "none" for rows without a kontaktperson from Navet, or "all". */
	responsible: string;
};

export const NO_FILTER: PlanFilter = { status: "all", responsible: "all" };

/**
 * Applies the status and kontaktperson filters. With a filter set, only the matching assigned
 * dates remain; free and closed dates are only shown for the whole plan.
 */
export function filterPlanDays(days: readonly PlanDay[], filter: PlanFilter): PlanDay[] {
	if (filter.status === "all" && filter.responsible === "all") return [...days];
	return days.filter((day) => {
		if (day.kind !== "assigned") return false;
		if (filter.status !== "all" && day.row.status !== filter.status) return false;
		if (filter.responsible === "none") return day.row.responsibleUserId === undefined;
		return filter.responsible === "all" || day.row.responsibleUserId === filter.responsible;
	});
}
