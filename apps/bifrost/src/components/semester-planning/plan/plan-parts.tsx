"use client";

import { api } from "@workspace/backend/convex/api";
import type { ApplicationStatus } from "@workspace/shared/semester/labels";
import { formatSemesterDay } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { CalendarCheck, CalendarDays, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useState } from "react";
import { toast } from "sonner";
import { dayOfMonth, initials } from "../format";
import { StatusIcon } from "../status-badge";
import type { PlanEventRow, PlanRow } from "./plan-days";

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

/** The title of an event in the plan, linking to the event, with its company underneath. */
export function EventTitle({ event }: Readonly<{ event: PlanEventRow }>) {
	return (
		<span className="inline-flex items-center gap-2">
			<Link href={`/events/${event.eventId}`} className="font-semibold text-[15px] hover:underline">
				{event.title}
			</Link>
			{!event.published && (
				<span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground">
					Ikke publisert
				</span>
			)}
		</span>
	);
}

/** What stands where an application's status would: this row is an event, not an application. */
export function EventKind({ extraDay }: Readonly<{ extraDay: boolean }>) {
	return (
		<span
			className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]"
			title={extraDay ? "Ikke en tirsdag eller torsdag" : undefined}
		>
			<CalendarDays className="size-4 text-muted-foreground" aria-hidden />
			Arrangement
			{extraDay && <span className="text-muted-foreground">· ikke tirsdag/torsdag</span>}
		</span>
	);
}

/** «Ta ut av planen»: removes the event from the plan. The event itself is kept. */
export function RemovePlanEventButton({ event }: Readonly<{ event: PlanEventRow }>) {
	const removeEvent = useMutation(api.semesterPlanning.planEvents.mutations.removeEvent);
	const [pending, setPending] = useState(false);

	const remove = async () => {
		setPending(true);
		try {
			await removeEvent({ planEventId: event._id });
			toast.success(`«${event.title}» er tatt ut av planen.`);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke ta arrangementet ut av planen."));
		} finally {
			setPending(false);
		}
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			disabled={pending}
			onClick={() => void remove()}
			aria-label={`Ta «${event.title}» ut av planen`}
			title="Ta ut av planen"
			className="text-muted-foreground hover:text-foreground"
		>
			<X aria-hidden />
		</Button>
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
const PLAN_STATUS_LABELS: Record<ApplicationStatus, string> = {
	confirmed: "Bekreftet",
	offer_sent: "Venter på svar",
	applied: "Tilbud ikke sendt",
	new_date_requested: "Vil endre dato",
	declined: "Takket nei",
	rejected: "Avslått",
	withdrawn: "Slettet",
};

/** The Plan's wording for a status, also used by its status filter. */
export function planStatusLabel(status: ApplicationStatus): string {
	return PLAN_STATUS_LABELS[status];
}

export function PlanStatus({ status }: Readonly<{ status: ApplicationStatus }>) {
	const label = PLAN_STATUS_LABELS[status];
	return (
		<span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]" title={label}>
			<StatusIcon status={status} />
			{label}
		</span>
	);
}
