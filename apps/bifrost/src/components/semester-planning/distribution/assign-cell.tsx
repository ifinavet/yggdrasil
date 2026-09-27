"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { EVENT_TYPE_SHORT_LABELS, STATUS_LABELS } from "@workspace/shared/semester/labels";
import { formatSemesterDay } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { type DragEvent, useState } from "react";
import { toast } from "sonner";
import { MOVE_CONFIRMED_WARNING } from "../application/model";
import { dayOfMonth, longDay, shortDay, studentRange } from "../format";
import { STATUS_CHIP_CLASSES } from "../status";
import type { CellKind } from "./cell-kind";
import { CELL_KIND_CLASSES, CHIP_BASE, DROP_TARGET } from "./cell-styles";

/** What moving the application's date does beyond the date, or nothing. */
function moveConsequence(status: Doc<"companyApplications">["status"]): string {
	if (status === "confirmed") return MOVE_CONFIRMED_WARNING;
	if (status === "offer_sent" || status === "new_date_requested") {
		return "Tilbudet som er sendt slutter å virke.";
	}
	return "";
}

/** Which chip is being dragged: the application and the date it holds now. */
export type DragState = { applicationId: string; from: string } | null;

function CellMark({
	kind,
	status,
	date,
	highlighted = false,
	dropTarget = false,
}: Readonly<{
	kind: CellKind | null;
	status: Doc<"companyApplications">["status"];
	date: string;
	highlighted?: boolean;
	dropTarget?: boolean;
}>) {
	if (kind === "got") {
		return <span className={cn(CHIP_BASE, STATUS_CHIP_CLASSES[status])}>{dayOfMonth(date)}</span>;
	}
	if (!kind) {
		return <span className={cn(CHIP_BASE, "group-hover:bg-muted/70")} />;
	}
	return (
		<span
			className={cn(CHIP_BASE, CELL_KIND_CLASSES[kind], (highlighted || dropTarget) && DROP_TARGET)}
		>
			{dayOfMonth(date)}
		</span>
	);
}

/**
 * A cell that cannot be clicked: a closed date, a date another company holds, or an application
 * that is locked or no longer active.
 */
export function StaticCell({
	kind,
	status,
	date,
	title,
}: Readonly<{
	kind: CellKind | null;
	status: Doc<"companyApplications">["status"];
	date: string;
	title?: string;
}>) {
	if (!kind) return null;
	return (
		<span className="block" title={title}>
			<CellMark kind={kind} status={status} date={date} />
		</span>
	);
}

/**
 * One date in one application's row. Clicking it asks «Tildel <dag>?» (or «Fjerne <dag>?» on the
 * assigned date) in a popover. The assigned chip can also be dragged onto another free date the
 * company ticked: the move happens at once with «Angre», unless an offer is out or accepted, which
 * asks first because the company must answer again. The backend has the last word: it refuses dates
 * another company holds and a published event with a Norwegian message, and accepts dates the
 * company did not tick, which gets a warning. Dates another company holds are never shown as this cell.
 */
export function AssignCell({
	application,
	date,
	kind,
	open,
	onOpenChange,
	drag,
	onDragChange,
}: Readonly<{
	application: Doc<"companyApplications">;
	date: string;
	kind: CellKind | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	drag: DragState;
	onDragChange: (drag: DragState) => void;
}>) {
	const assignDate = useMutation(api.semesterPlanning.applications.mutations.assignDate);
	const [saving, setSaving] = useState(false);

	const name = application.registry.name;
	const isOwn = kind === "got";
	const fullDay = formatSemesterDay(date, "long");
	const day = longDay(date);
	const ticked = application.availableDates.includes(date);
	// What changes beyond the date, so the move asks first.
	const consequence = moveConsequence(application.status);

	const draggable = isOwn;
	const dropTarget = drag?.applicationId === application._id && (kind === "can" || kind === "req");

	const move = async (from: string) => {
		try {
			await assignDate({ applicationId: application._id, date });
			toast.success(`${name} er flyttet til ${shortDay(date)}.`, {
				action: {
					label: "Angre",
					onClick: () => {
						assignDate({ applicationId: application._id, date: from }).catch((error) =>
							toast.error(convexErrorMessage(error, "Kunne ikke angre. Prøv igjen.")),
						);
					},
				},
			});
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke flytte datoen. Prøv igjen."));
		}
	};

	const drop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		const from = drag?.from;
		onDragChange(null);
		if (!dropTarget || !from) return;
		if (consequence) onOpenChange(true);
		else void move(from);
	};

	const submit = async () => {
		setSaving(true);
		try {
			const { outsideAvailable } = await assignDate({
				applicationId: application._id,
				date: isOwn ? null : date,
			});
			if (isOwn) toast.success("Datoen er fjernet.");
			else if (outsideAvailable) {
				toast.warning(`${name} har ikke krysset av ${shortDay(date)}. Datoen er tildelt likevel.`);
			} else toast.success(`${name} har fått ${shortDay(date)}.`);
			onOpenChange(false);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke endre datoen. Prøv igjen."));
		} finally {
			setSaving(false);
		}
	};

	let note: string;
	let warning = false;
	if (isOwn) {
		note = consequence
			? `${consequence} Søknaden går tilbake til «Søkt».`
			: "Datoen blir ledig igjen.";
	} else if (kind === "req") {
		note = "Datoen er ledig, og bedriften har bedt om den.";
	} else if (ticked) {
		note = "Datoen er ledig, og de har krysset den av.";
	} else {
		note = "Bedriften har ikke krysset av denne datoen.";
		warning = true;
	}
	const moveFrom =
		!isOwn && application.assignedDate
			? [` Flyttes fra ${shortDay(application.assignedDate)}.`, consequence].join(" ").trimEnd()
			: "";

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={isOwn ? `Fjern ${fullDay} fra ${name}` : `Tildel ${fullDay} til ${name}`}
					title={isOwn ? `${STATUS_LABELS[application.status]}. Dra for å flytte.` : undefined}
					draggable={draggable}
					onDragStart={(event) => {
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData("text/plain", application._id);
						onDragChange({ applicationId: application._id, from: date });
					}}
					onDragEnd={() => onDragChange(null)}
					onDragOver={(event) => {
						if (dropTarget) {
							event.preventDefault();
							event.dataTransfer.dropEffect = "move";
						}
					}}
					onDrop={drop}
					className={cn(
						"group block w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
						draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
					)}
				>
					<CellMark
						kind={kind}
						status={application.status}
						date={date}
						highlighted={open && !isOwn}
						dropTarget={dropTarget}
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-[268px] rounded-[10px] px-3.5 py-3" align="center">
				<p className="font-semibold text-sm">{isOwn ? `Fjerne ${day}?` : `Tildel ${day}?`}</p>
				<p className="mt-1 text-[12.5px] text-muted-foreground leading-[1.45]">
					{name} · {EVENT_TYPE_SHORT_LABELS[application.eventType].toLowerCase()},{" "}
					{studentRange(application.minStudents, application.maxStudents)}. {!warning && note}
					{moveFrom}
				</p>
				{warning && (
					<p className="mt-1.5 flex gap-1.5 font-medium text-[12.5px] text-foreground leading-[1.45]">
						<TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-status-new-date" aria-hidden />
						{note}
					</p>
				)}
				<div className="mt-2.5 flex gap-2">
					<Button size="sm" className="text-[13px]" disabled={saving} onClick={submit}>
						{isOwn ? "Fjern" : "Tildel"}
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="text-[13px]"
						disabled={saving}
						onClick={() => onOpenChange(false)}
					>
						Avbryt
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
