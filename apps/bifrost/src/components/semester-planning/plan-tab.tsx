"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { formatSemesterDay } from "@workspace/shared/time";
import { Panel } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import { type ReactNode, useState } from "react";
import { AddPlanEventButton } from "./plan/add-plan-event";
import { PlanCards } from "./plan/plan-cards";
import {
	buildPlanDays,
	filterPlanDays,
	NO_FILTER,
	type PlanDay,
	type PlanFilter,
} from "./plan/plan-days";
import { PlanTable } from "./plan/plan-table";
import { PlanToolbar } from "./plan/plan-toolbar";
import { SemesterActions } from "./semester-actions";

/**
 * The Plan tab: the semester plan with the old Excel sheet's columns, one row per Tuesday and
 * Thursday, plus the events editors put in the plan by hand or from the calendar. Every internal
 * member sees it; editors also see contact details and can add and remove events.
 */
export function PlanTab({
	semester,
	canEdit,
}: Readonly<{ semester: Doc<"semesters">; canEdit: boolean }>) {
	// The planner keys this tab by semester, so switching semester starts over with the whole plan.
	const [filter, setFilter] = useState<PlanFilter>(NO_FILTER);
	const details = useQuery(api.semesterPlanning.semesters.queries.get, {
		semesterId: semester._id,
	});
	const rows = useQuery(api.semesterPlanning.applications.queries.getPlan, {
		semesterId: semester._id,
	});
	const events = useQuery(api.semesterPlanning.planEvents.queries.listForSemester, {
		semesterId: semester._id,
	});
	const applications = useQuery(
		api.semesterPlanning.applications.queries.listForSemester,
		canEdit ? { semesterId: semester._id } : "skip",
	);

	const loading = !details || !rows || !events || (canEdit && !applications);
	const days = loading ? [] : buildPlanDays(details.dates, rows, applications, events);
	const shown = filterPlanDays(days, filter);
	const deadline = details?.semester.applicationDeadline;
	const editable = canEdit && semester.status !== "closed";

	return (
		<div className="grid min-w-0 gap-4">
			<SemesterActions>
				<PlanToolbar
					rows={[...(rows ?? []), ...(events ?? [])]}
					filter={filter}
					onFilterChange={setFilter}
				/>
				{editable && <AddPlanEventButton semester={semester} />}
			</SemesterActions>

			{loading ? (
				<Skeleton className="h-96 w-full rounded-lg" />
			) : (
				<PlanBody
					hasDates={details.dates.length > 0}
					hasEntries={rows.length > 0 || events.length > 0}
					deadline={deadline}
					days={shown}
					canEdit={canEdit}
					editable={editable}
				/>
			)}
		</div>
	);
}

function EmptyState({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
	return (
		<Panel className="px-4 py-14 text-center">
			<p className="font-semibold text-base">{title}</p>
			<p className="mt-1.5 mb-4 text-[13.5px] text-muted-foreground">{children}</p>
		</Panel>
	);
}

/** The plan once loaded: a note while it is empty, then the table, or cards on small screens. */
function PlanBody({
	hasDates,
	hasEntries,
	deadline,
	days,
	canEdit,
	editable,
}: Readonly<{
	hasDates: boolean;
	hasEntries: boolean;
	deadline: string | undefined;
	days: PlanDay[];
	canEdit: boolean;
	editable: boolean;
}>) {
	if (!hasDates) {
		return (
			<EmptyState title="Ingen datoer ennå">
				Planen fylles ut når semesteret har fått første og siste dato.
			</EmptyState>
		);
	}

	return (
		<>
			{!hasEntries && (
				<EmptyState title="Ingen søknader eller arrangementer ennå">
					Alle datoene under er ledige.
					{deadline && ` Søknadsfrist ${formatSemesterDay(deadline, "long")}.`}
					{editable && " Arrangementer som allerede er i kalenderen kan legges til i planen."}
				</EmptyState>
			)}

			<section aria-label="Semesterplan" className="min-w-0">
				<Panel className="overflow-hidden">
					{days.length === 0 ? (
						<p className="px-4 py-10 text-center text-muted-foreground text-sm">
							Ingen datoer passer filteret.
						</p>
					) : (
						<>
							<div className="hidden md:block">
								<PlanTable days={days} showContactDetails={canEdit} canEdit={editable} />
							</div>
							<div className="md:hidden">
								<PlanCards days={days} showContactDetails={canEdit} canEdit={editable} />
							</div>
						</>
					)}
				</Panel>
			</section>
		</>
	);
}
