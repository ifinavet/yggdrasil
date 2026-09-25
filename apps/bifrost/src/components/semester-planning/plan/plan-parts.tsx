"use client";

import type { ApplicationStatus } from "@workspace/shared/semester/labels";
import { formatSemesterDay } from "@workspace/shared/time";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { cn } from "@workspace/ui/lib/utils";
import {
	CalendarCheck,
	CalendarSync,
	CircleCheck,
	CircleX,
	Clock,
	type LucideIcon,
	Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { dayOfMonth, initials } from "../format";
import type { PlanRow } from "./plan-days";

/**
 * A small calendar tile: weekday, day of the month and month, e.g. «TIR 9 feb.». Free and closed
 * days get a compact one-line tile, so the plan stays short.
 */
export function DateTile({ date, muted = false }: Readonly<{ date: string; muted?: boolean }>) {
	const day = dayOfMonth(date);
	const weekday = formatSemesterDay(date, "weekdayMin");
	if (muted) {
		return (
			<span className="inline-flex w-12 items-baseline justify-center gap-1 rounded-md bg-muted/60 py-0.5 text-muted-foreground leading-none">
				<span className="text-[10px] uppercase tracking-wide">{weekday}</span>
				<span className="font-semibold text-[13px] tabular-nums">{day}</span>
			</span>
		);
	}
	return (
		<span className="inline-flex w-12 shrink-0 flex-col items-center self-start rounded-lg border bg-card py-1 leading-none shadow-xs">
			<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
				{weekday}
			</span>
			<span className="my-0.5 font-semibold text-[18px] tabular-nums">{day}</span>
			<span className="text-[10.5px] text-muted-foreground">
				{formatSemesterDay(date, "monthShort")}
			</span>
		</span>
	);
}

/** A Navet member with their initials, as kontaktperson or medhjelper. */
export function Person({ name, small = false }: Readonly<{ name: string; small?: boolean }>) {
	return (
		<span className={cn("inline-flex items-center gap-2", small && "text-[13px]")}>
			<Avatar aria-hidden className={small ? "size-6" : "size-8"}>
				<AvatarFallback
					className={cn(
						"bg-primary-light font-semibold text-primary dark:bg-muted dark:text-foreground",
						small ? "text-[10px]" : "text-[11.5px]",
					)}
				>
					{initials(name)}
				</AvatarFallback>
			</Avatar>
			<span className="truncate">{name}</span>
		</span>
	);
}

/** The company name, linking editors to the application, and a link to its event once created. */
export function CompanyName({
	row,
	linkApplication,
	stretched = false,
}: Readonly<{
	row: PlanRow;
	linkApplication: boolean;
	/** The link covers the nearest positioned ancestor, so the whole card opens the application. */
	stretched?: boolean;
}>) {
	return (
		<span className="inline-flex items-center gap-2">
			{linkApplication ? (
				<Link
					href={`/semesterplan/soknad/${row._id}`}
					className={cn(
						"font-semibold text-[15px] hover:underline",
						stretched && "after:absolute after:inset-0",
					)}
				>
					{row.companyName}
				</Link>
			) : (
				<span className="font-semibold text-[15px]">{row.companyName}</span>
			)}
			{row.eventId && (
				<Link
					href={`/events/${row.eventId}`}
					title="Åpne arrangementet"
					aria-label={`Åpne arrangementet til ${row.companyName}`}
					className="relative z-10 text-muted-foreground hover:text-foreground"
				>
					<CalendarCheck className="size-4" aria-hidden />
				</Link>
			)}
		</span>
	);
}

/**
 * Opens an application when its whole row is clicked. Clicks on links inside the row, like the
 * company name or the event icon, keep their own target. Returns nothing for internal members,
 * who can't open applications.
 */
export function useOpenApplication(enabled: boolean) {
	const router = useRouter();
	if (!enabled) return undefined;

	return (applicationId: string) => (event: MouseEvent<HTMLElement>) => {
		if (event.target instanceof Element && event.target.closest("a")) return;
		router.push(`/semesterplan/soknad/${applicationId}`);
	};
}

/**
 * A plan row's status as a symbol with a short label: a check when the date is confirmed, a clock
 * while the company has not answered, an envelope while no offer is sent, and a calendar with
 * arrows when the company wants another date. The labels say what is going on rather than the
 * editors' status names in STATUS_LABELS on purpose, since the whole organisation reads the
 * Plan; its status filter uses the same words.
 */
const STATUS_SYMBOLS: Record<
	ApplicationStatus,
	{ icon: LucideIcon; label: string; className: string }
> = {
	confirmed: { icon: CircleCheck, label: "Bekreftet", className: "text-status-confirmed" },
	offer_sent: { icon: Clock, label: "Venter på svar", className: "text-status-offer" },
	applied: { icon: Send, label: "Tilbud ikke sendt", className: "text-muted-foreground" },
	new_date_requested: {
		icon: CalendarSync,
		label: "Vil endre dato",
		className: "text-status-new-date",
	},
	declined: { icon: CircleX, label: "Takket nei", className: "text-muted-foreground" },
	rejected: { icon: CircleX, label: "Avslått", className: "text-muted-foreground" },
	withdrawn: { icon: CircleX, label: "Trukket", className: "text-muted-foreground" },
};

/** The Plan's wording for a status, also used by its status filter. */
export function planStatusLabel(status: ApplicationStatus): string {
	return STATUS_SYMBOLS[status].label;
}

export function PlanStatus({ status }: Readonly<{ status: ApplicationStatus }>) {
	const { icon: Icon, label, className } = STATUS_SYMBOLS[status];
	return (
		<span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]" title={label}>
			<Icon aria-hidden className={cn("size-[18px] shrink-0", className)} strokeWidth={2.25} />
			{label}
		</span>
	);
}
