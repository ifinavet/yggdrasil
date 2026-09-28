"use client";

import { api } from "@workspace/backend/convex/api";
import { closedDateLabel } from "@workspace/shared/semester/labels";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { differenceInCalendarMonths, format, parse } from "date-fns";
import { nb } from "date-fns/locale";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DayButtonProps } from "react-day-picker";
import { toast } from "sonner";
import { capitalize, longDay, shortDay } from "../format";
import {
	type Application,
	MOVE_CONFIRMED_WARNING,
	type SemesterContext,
	useRunMutation,
} from "./model";

const OFFER_STATUSES: ReadonlySet<Application["status"]> = new Set([
	"offer_sent",
	"new_date_requested",
	"confirmed",
]);

/** Whether giving the application a new date takes back an offer the company has or accepted. */
export function replacesOffer(application: Application): boolean {
	return OFFER_STATUSES.has(application.status);
}

/** Gives the application a date, or clears it with null, and says how it went. */
export function useAssignDate(application: Application, companyName: string) {
	const assignDate = useMutation(api.semesterPlanning.applications.mutations.assignDate);
	const { pending, run } = useRunMutation();

	const assign = useCallback(
		(date: string | null) =>
			run(
				() => assignDate({ applicationId: application._id, date }),
				({ outsideAvailable }) => {
					if (date === null) toast.success("Datoen er fjernet.");
					else if (outsideAvailable)
						toast.warning(
							`${companyName} har ikke krysset av ${shortDay(date)}. Datoen er valgt likevel.`,
						);
					else toast.success(`${companyName} har fått ${shortDay(date)}.`);
				},
			),
		[application._id, assignDate, companyName, run],
	);

	return { assign, pending };
}

type DateOption = {
	date: string;
	checked: boolean;
	requested: boolean;
	/** Why the day cannot be picked, and the closed label or the company holding it. */
	blocked?: { reason: "stengt" | "tatt"; detail: string };
};

/**
 * Picks a date for the application among the semester's days. The days the company ticked or
 * asked for come first; a closed or taken day cannot be picked.
 */
export function AssignDateDialog({
	open,
	onOpenChange,
	application,
	companyName,
	context,
	requestedDates,
	initialDate,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	application: Application;
	companyName: string;
	context: SemesterContext;
	requestedDates: string[];
	initialDate?: string;
}>) {
	const { assign, pending } = useAssignDate(application, companyName);
	const [picked, setPicked] = useState<string | undefined>(initialDate);
	const [lastInitial, setLastInitial] = useState(initialDate);
	if (initialDate !== lastInitial) {
		setLastInitial(initialDate);
		setPicked(initialDate);
	}

	const checked = new Set(application.availableDates);
	const requested = new Set(requestedDates);
	const options: DateOption[] = context.dates
		.filter((day) => day.date !== application.assignedDate || !replacesOffer(application))
		.map((day) => ({
			date: day.date,
			checked: checked.has(day.date),
			requested: requested.has(day.date),
			blocked: blockedReason(day.closedLabel, context.takenBy.get(day.date)),
		}));
	const pickedOption = options.find((option) => option.date === picked);

	const close = (next: boolean) => {
		if (!next) setPicked(initialDate);
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Velg dato for {companyName}</DialogTitle>
					<DialogDescription>{assignDescription(application)}</DialogDescription>
				</DialogHeader>

				<DateCalendar options={options} picked={picked} onPick={setPicked} />

				{pickedOption && !pickedOption.checked && !pickedOption.requested && (
					<p role="alert" className="font-medium text-attention text-sm">
						{companyName} har ikke krysset av {shortDay(pickedOption.date)}. Du kan velge den
						likevel.
					</p>
				)}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => close(false)}>
						Avbryt
					</Button>
					<Button
						type="button"
						disabled={!picked || pending}
						onClick={async () => {
							if (picked && (await assign(picked))) close(false);
						}}
					>
						{assignLabel(pending, picked)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** What giving the application a date does to its status and any offer. */
function assignDescription(application: Application): string {
	if (application.status === "confirmed") {
		return `Søknaden går tilbake til «Søkt». ${MOVE_CONFIRMED_WARNING}`;
	}
	if (replacesOffer(application) && application.assignedDate) {
		return `Tilbudet på ${shortDay(application.assignedDate)} slutter å gjelde, og søknaden går tilbake til «Søkt» til du sender nytt tilbud.`;
	}
	return "Velg en dato. Tilbudet lages først når du trykker «Lag tilbud».";
}

function assignLabel(pending: boolean, picked: string | undefined): string {
	if (pending) return "Velger …";
	return picked ? `Velg ${shortDay(picked)}` : "Velg dato";
}

function blockedReason(
	closedLabel: string | undefined,
	holder: string | undefined,
): DateOption["blocked"] {
	if (closedLabel !== undefined) return { reason: "stengt", detail: closedDateLabel(closedLabel) };
	if (holder) return { reason: "tatt", detail: holder };
	return undefined;
}

const ISO_DAY = "yyyy-MM-dd";

const CELL = "grid h-9 w-full place-items-center rounded-md text-[13px] tabular-nums";

const STRIPED =
	"bg-[repeating-linear-gradient(135deg,var(--muted)_0_3px,transparent_3px_6px)] text-muted-foreground";

/** The chip style for a semester day, by what the company said about it and whether it is free. */
function dayClasses(option: DateOption, isPicked: boolean): string {
	if (isPicked) return "border border-primary bg-primary font-semibold text-primary-foreground";
	if (option.blocked) return cn(STRIPED, "line-through decoration-foreground/40");
	if (option.requested) {
		return "border-2 border-status-new-date bg-background font-semibold text-foreground hover:bg-muted";
	}
	if (option.checked) {
		return "border border-primary/40 bg-primary-light font-semibold text-primary hover:border-primary";
	}
	return "border border-border bg-background text-foreground hover:bg-muted";
}

/** How a screen reader hears a day: «krysset av», «ønsket», «stengt: Kickoff», «tatt av X» or «ledig». */
function dayState(option: DateOption): string {
	if (option.blocked) return `${option.blocked.reason}: ${option.blocked.detail}`;
	if (option.requested) return "ønsket av bedriften";
	if (option.checked) return "krysset av av bedriften";
	return "ledig";
}

const DateCalendarContext = createContext<{
	byDate: ReadonlyMap<string, DateOption>;
	picked: string | undefined;
	onPick: (date: string) => void;
}>({ byDate: new Map(), picked: undefined, onPick: () => {} });

function toDay(date: string): Date {
	return parse(date, ISO_DAY, new Date());
}

/**
 * The semester as one small calendar per month. Only the semester's days can be picked; the days
 * the company ticked are tinted, a day it asked for is ringed, and closed or taken days are
 * striped. The picked day is filled.
 */
function DateCalendar({
	options,
	picked,
	onPick,
}: Readonly<{
	options: DateOption[];
	picked: string | undefined;
	onPick: (date: string) => void;
}>) {
	const byDate = useMemo(() => new Map(options.map((option) => [option.date, option])), [options]);
	const context = useMemo(() => ({ byDate, picked, onPick }), [byDate, picked, onPick]);
	const first = options[0]?.date;
	const last = options.at(-1)?.date;
	if (first === undefined || last === undefined) {
		return <p className="text-muted-foreground text-sm">Semesteret har ingen datoer.</p>;
	}
	const firstDay = toDay(first);

	return (
		<DateCalendarContext.Provider value={context}>
			<Calendar
				mode="single"
				selected={picked ? toDay(picked) : undefined}
				onSelect={(day) => day && onPick(format(day, ISO_DAY))}
				month={firstDay}
				numberOfMonths={differenceInCalendarMonths(toDay(last), firstDay) + 1}
				hideNavigation
				disableNavigation
				showOutsideDays={false}
				ISOWeek
				locale={nb}
				disabled={(day) => {
					const option = byDate.get(format(day, ISO_DAY));
					return !option || option.blocked !== undefined;
				}}
				formatters={{
					formatCaption: (month) => capitalize(format(month, "LLLL", { locale: nb })),
					formatWeekdayName: (weekday) => format(weekday, "EEEEE", { locale: nb }),
				}}
				className="w-full bg-transparent p-0"
				classNames={{
					root: "w-full",
					months: "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3",
					month: "rounded-xl border bg-background/60 p-3 shadow-xs",
					month_caption: "mb-2 border-b pb-2",
					caption_label: "font-semibold text-sm",
					month_grid: "w-full table-fixed border-separate border-spacing-0.5",
					weekdays: "",
					weekday: "pb-1 font-medium text-muted-foreground text-xs",
					week: "",
					day: "p-0",
					today: "",
					disabled: "",
					outside: "",
				}}
				components={{ DayButton: DateCalendarDay }}
			/>
			<Legend />
		</DateCalendarContext.Provider>
	);
}

/** A day in the calendar: a semester date is a chip in its state, any other day is just a number. */
function DateCalendarDay({
	day,
	modifiers: _modifiers,
	className: _className,
	...props
}: DayButtonProps) {
	const { byDate, picked } = useContext(DateCalendarContext);
	const option = byDate.get(day.isoDate);
	if (!option) {
		return (
			<span aria-hidden className={cn(CELL, "text-muted-foreground/60")}>
				{day.date.getDate()}
			</span>
		);
	}
	const isPicked = option.date === picked;
	return (
		<button
			{...props}
			type="button"
			disabled={option.blocked !== undefined}
			aria-pressed={isPicked}
			aria-label={`${capitalize(longDay(option.date))}, ${dayState(option)}`}
			title={
				option.blocked
					? `${capitalize(option.blocked.reason)}: ${option.blocked.detail}`
					: undefined
			}
			className={cn(
				CELL,
				"outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed",
				dayClasses(option, isPicked),
			)}
		>
			{day.date.getDate()}
		</button>
	);
}

/** What the tints and stripes mean, under the calendar. */
function Legend() {
	const swatch = (className: string) => (
		<span aria-hidden className={cn("inline-block size-3.5 rounded-sm border", className)} />
	);
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-muted-foreground text-xs">
			<li className="flex items-center gap-1.5">
				{swatch("border-primary/40 bg-primary-light")} Krysset av av bedriften
			</li>
			<li className="flex items-center gap-1.5">
				{swatch("border-2 border-status-new-date bg-background")} Ønsket av bedriften
			</li>
			<li className="flex items-center gap-1.5">{swatch("border-border bg-background")} Ledig</li>
			<li className="flex items-center gap-1.5">
				{swatch(cn(STRIPED, "border-border"))} Stengt eller tatt
			</li>
		</ul>
	);
}
