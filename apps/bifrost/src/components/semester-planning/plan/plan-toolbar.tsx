"use client";

import type { ApplicationStatus } from "@workspace/shared/semester/labels";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import type { PlanFilter, PlanRow } from "./plan-days";
import { planStatusLabel } from "./plan-parts";

const FILTER_STATUSES: ApplicationStatus[] = [
	"applied",
	"offer_sent",
	"new_date_requested",
	"confirmed",
];

/** The Plan tab's filters, shown in the semester toolbar. */
export function PlanToolbar({
	rows,
	filter,
	onFilterChange,
}: Readonly<{
	rows: readonly PlanRow[];
	filter: PlanFilter;
	onFilterChange: (filter: PlanFilter) => void;
}>) {
	const responsibles = new Map<string, string>();
	for (const row of rows) {
		if (row.responsibleUserId && row.responsibleName) {
			responsibles.set(row.responsibleUserId, row.responsibleName);
		}
	}
	const sortedResponsibles = [...responsibles].sort(([, a], [, b]) => a.localeCompare(b, "nb"));

	// The filters sit right after the tabs, not with the buttons at the far right.
	return (
		<div className="flex flex-wrap items-center gap-3 sm:me-auto">
			<Select
				value={filter.status}
				onValueChange={(status) =>
					onFilterChange({ ...filter, status: status as PlanFilter["status"] })
				}
			>
				<SelectTrigger className="min-w-[140px]" aria-label="Filtrer på status">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Alle statuser</SelectItem>
					{FILTER_STATUSES.map((status) => (
						<SelectItem key={status} value={status}>
							{planStatusLabel(status)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={filter.responsible}
				onValueChange={(responsible) => onFilterChange({ ...filter, responsible })}
			>
				<SelectTrigger className="min-w-40" aria-label="Filtrer på kontaktperson fra Navet">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Alle kontaktpersoner</SelectItem>
					<SelectItem value="none">Uten kontaktperson</SelectItem>
					{sortedResponsibles.map(([userId, name]) => (
						<SelectItem key={userId} value={userId}>
							{name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
