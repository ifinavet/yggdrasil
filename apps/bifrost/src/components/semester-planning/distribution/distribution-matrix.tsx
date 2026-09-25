"use client";

import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { closedDateLabel, EVENT_TYPE_SHORT_LABELS } from "@workspace/shared/semester/labels";
import { formatSemesterDay } from "@workspace/shared/time";
import { cn } from "@workspace/ui/lib/utils";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, memo, useMemo, useState } from "react";
import { dayOfMonth, monthLabel, shortDayTitle, studentRange } from "../format";
import { isActiveStatus } from "../status";
import { StatusBadge } from "../status-badge";
import { AssignCell, type DragState, StaticCell } from "./assign-cell";
import { cellKind } from "./cell-kind";
import { CLOSED_COLUMN } from "./cell-styles";

type Application = Doc<"companyApplications">;
type SemesterDate = Doc<"semesterDates">;

/** The date whose popover is open, in which application's row. */
type OpenCell = { applicationId: Id<"companyApplications">; date: string } | null;

const NO_DATES: readonly string[] = [];

// The company and status columns stay put while the dates scroll sideways inside the card.
const STICKY = "sticky left-0 z-10 border-r bg-card";
// On phones only the company column is pinned, so the dates keep enough room.
const STICKY_END = "right-0 z-10 border-l bg-card sm:sticky";

/** Why a cell cannot be clicked: the date is closed, the semester locked, or another company has it. */
function staticCellTitle(
	closedLabel: string | undefined,
	lockedReason: string | undefined,
	takenBy: string | undefined,
): string | undefined {
	if (closedLabel !== undefined) return `Stengt: ${closedDateLabel(closedLabel)}`;
	if (lockedReason) return lockedReason;
	return takenBy && `Tatt av ${takenBy}`;
}

/** Groups the dates into months for the header, remembering where each month starts. */
function monthsOf(dates: readonly SemesterDate[]) {
	const months: { key: string; label: string; span: number }[] = [];
	const starts = new Set<string>();
	for (const { date } of dates) {
		const key = date.slice(0, 7);
		const last = months.at(-1);
		if (last?.key === key) last.span++;
		else {
			months.push({ key, label: monthLabel(date), span: 1 });
			starts.add(date);
		}
	}
	return { months, starts };
}

/**
 * The Fordeling calendar. Each row is an application, each column a Tuesday or Thursday. A row
 * shows the dates the company can do as chips with the day on them; the assigned one is filled
 * with the application's status colour and can be dragged to another of its dates. Clicking a
 * chip assigns or removes the date.
 */
export function DistributionMatrix({
	applications,
	dates,
	holders,
	requestedDates,
	semesterClosed,
}: Readonly<{
	applications: readonly Application[];
	dates: readonly SemesterDate[];
	holders: ReadonlyMap<string, Application>;
	/** The dates each company asked for instead of its offer. */
	requestedDates: ReadonlyMap<Id<"companyApplications">, readonly string[]>;
	/** A closed semester is read-only: dates can no longer be assigned or moved. */
	semesterClosed: boolean;
}>) {
	const [openCell, setOpenCell] = useState<OpenCell>(null);
	const [drag, setDrag] = useState<DragState>(null);
	const { months, starts } = useMemo(() => monthsOf(dates), [dates]);

	return (
		<div className="relative overflow-x-auto overscroll-x-contain">
			<table
				// Fixed layout needs an explicit width: the company and status columns plus 52px per date.
				style={{ "--dates": dates.length } as CSSProperties}
				className="w-[calc(var(--dates)*52px+22rem)] table-fixed border-separate border-spacing-0 text-[13px] leading-[normal] sm:w-[calc(var(--dates)*52px+456px)]"
			>
				<colgroup>
					<col className="w-44 sm:w-60" />
					{dates.map(({ date }) => (
						<col key={date} className="w-[52px]" />
					))}
					<col className="w-44 sm:w-[216px]" />
				</colgroup>
				<thead className="text-muted-foreground">
					<tr>
						<th className={cn(STICKY, "h-[26px]")} aria-hidden />
						{months.map((month) => (
							<th
								key={month.key}
								colSpan={month.span}
								scope="colgroup"
								className="h-8 border-l pl-2 text-left font-semibold text-[13px] text-foreground"
							>
								{month.label}
							</th>
						))}
						<th className={STICKY_END} aria-hidden />
					</tr>
					<tr>
						<th
							scope="col"
							className={cn(STICKY, "border-b pr-3 pb-2 pl-4 text-left align-bottom font-medium")}
						>
							Søknad
						</th>
						{dates.map(({ date, closedLabel }) => (
							<th
								key={date}
								scope="col"
								title={closedLabel === undefined ? undefined : closedDateLabel(closedLabel)}
								className={cn(
									"h-12 border-b pb-2 text-center align-bottom font-medium text-[12px] leading-tight",
									closedLabel !== undefined && CLOSED_COLUMN,
									starts.has(date) && "border-l",
								)}
							>
								{formatSemesterDay(date, "weekdayMin")}
								<b
									className={cn(
										"block font-semibold text-[14px]",
										closedLabel !== undefined
											? "text-muted-foreground line-through"
											: "text-foreground",
									)}
								>
									{dayOfMonth(date)}
								</b>
								{closedLabel !== undefined && (
									<span className="sr-only">Stengt: {closedDateLabel(closedLabel)}</span>
								)}
							</th>
						))}
						<th
							scope="col"
							className={cn(STICKY_END, "border-b px-3 pb-2 text-left align-bottom font-medium")}
						>
							Status
						</th>
					</tr>
				</thead>
				<tbody>
					{/* Each row only gets the open cell and the drag when they are its own, so opening a
					    popover or dragging a chip re-renders one row, not the whole calendar. */}
					{applications.map((application) => (
						<MatrixRow
							key={application._id}
							application={application}
							dates={dates}
							monthStarts={starts}
							holders={holders}
							requested={requestedDates.get(application._id) ?? NO_DATES}
							openDate={openCell?.applicationId === application._id ? openCell.date : null}
							onOpenCellChange={setOpenCell}
							drag={drag?.applicationId === application._id ? drag : null}
							onDragChange={setDrag}
							semesterClosed={semesterClosed}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

const MatrixRow = memo(function MatrixRow({
	application,
	dates,
	monthStarts,
	holders,
	requested,
	openDate,
	onOpenCellChange,
	drag,
	onDragChange,
	semesterClosed,
}: Readonly<{
	application: Application;
	dates: readonly SemesterDate[];
	monthStarts: ReadonlySet<string>;
	holders: ReadonlyMap<string, Application>;
	requested: readonly string[];
	/** The date in this row whose popover is open, if any. */
	openDate: string | null;
	onOpenCellChange: (cell: OpenCell) => void;
	/** The chip being dragged, when it is in this row. */
	drag: DragState;
	onDragChange: (drag: DragState) => void;
	semesterClosed: boolean;
}>) {
	const active = isActiveStatus(application.status);
	// A closed semester is read-only, so its cells are shown but cannot be clicked or dragged.
	const editable = active && !semesterClosed;
	const lockedReason = semesterClosed
		? "Semesteret er stengt, så datoene kan ikke endres."
		: undefined;
	const selected = openDate !== null;
	const industry = application.registry.industry?.description;

	return (
		<tr className={cn(selected && "[&>td]:bg-muted")}>
			<th
				scope="row"
				className={cn(
					STICKY,
					"border-b py-2 pr-3 pl-4 text-left align-middle font-normal",
					selected && "bg-muted",
				)}
			>
				<div className={cn(!active && "opacity-55")}>
					<Link
						href={`/semesterplan/soknad/${application._id}`}
						className="block truncate font-semibold text-[13.5px] hover:underline"
					>
						{application.registry.name}
					</Link>
					<div className="mt-0.5 truncate text-[12px] text-muted-foreground tabular-nums">
						{EVENT_TYPE_SHORT_LABELS[application.eventType]} ·{" "}
						{studentRange(application.minStudents, application.maxStudents)}
						{industry && ` · ${industry}`}
					</div>
					{application.datePreferences && (
						<div
							className="mt-[3px] inline-flex max-w-full items-center gap-1 text-[12px] text-attention"
							title={application.datePreferences}
						>
							<MessageCircle className="size-[13px] shrink-0" aria-hidden />
							<span className="truncate">{application.datePreferences}</span>
						</div>
					)}
				</div>
			</th>
			{dates.map(({ date, closedLabel }) => {
				const kind = cellKind({ application, date, requested, holders });
				const holder = holders.get(date);
				// Another company holds the date, so it cannot be given to this one. It stays visible,
				// faded, with the holder in the tooltip.
				const takenBy = holder && holder._id !== application._id ? holder.registry.name : undefined;
				return (
					<td
						key={date}
						className={cn(
							"border-b p-0 text-center",
							closedLabel !== undefined && CLOSED_COLUMN,
							monthStarts.has(date) && "border-l",
						)}
					>
						{editable && closedLabel === undefined && !takenBy ? (
							<AssignCell
								application={application}
								date={date}
								kind={kind}
								open={openDate === date}
								onOpenChange={(open) =>
									onOpenCellChange(open ? { applicationId: application._id, date } : null)
								}
								drag={drag}
								onDragChange={onDragChange}
							/>
						) : (
							<StaticCell
								kind={closedLabel === undefined ? kind : null}
								status={application.status}
								date={date}
								title={staticCellTitle(closedLabel, kind ? lockedReason : undefined, takenBy)}
							/>
						)}
					</td>
				);
			})}
			<td className={cn(STICKY_END, "border-b px-3 align-middle")}>
				<div className={cn(!active && "opacity-55")}>
					<StatusBadge status={application.status} className="gap-[7px] text-[13px]" />
					<div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
						{active && application.assignedDate
							? shortDayTitle(application.assignedDate)
							: "Ingen dato"}
					</div>
				</div>
			</td>
		</tr>
	);
});
