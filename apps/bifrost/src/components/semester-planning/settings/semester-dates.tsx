"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { closedDateLabel } from "@workspace/shared/semester/labels";
import { formatSemesterDay } from "@workspace/shared/semester/time";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation } from "convex/react";
import { differenceInCalendarMonths, format, parse } from "date-fns";
import { nb } from "date-fns/locale";
import { createContext, useContext, useState } from "react";
import type { DayButtonProps, MonthProps } from "react-day-picker";
import { toast } from "sonner";
import { convexErrorMessage } from "@/utils/convex-error";
import { capitalize, longDay, shortDay } from "../format";

type SemesterDate = Doc<"semesterDates">;

const ISO_DAY = "yyyy-MM-dd";

const CELL = "grid h-9 w-full place-items-center rounded-md text-[13px] tabular-nums";

const OPEN_DATE =
	"border border-border bg-background font-semibold text-foreground hover:border-foreground/40 hover:bg-muted";

const CLOSED_DATE =
	"bg-[repeating-linear-gradient(135deg,var(--muted)_0_3px,transparent_3px_6px)] font-medium text-muted-foreground line-through decoration-foreground/40 hover:bg-muted";

/** The semester's dates, and which one has its popover open, for the calendar's custom parts. */
const SemesterDatesContext = createContext<{
	byDate: ReadonlyMap<string, SemesterDate>;
	locked: boolean;
	openDate: string | null;
	setOpenDate: (date: string | null) => void;
}>({ byDate: new Map(), locked: true, openDate: null, setOpenDate: () => {} });

function toDay(date: string): Date {
	return parse(date, ISO_DAY, new Date());
}

/**
 * The semester as one small framed calendar per month. Only the Tuesdays and Thursdays of the
 * semester can be clicked: an editor closes the dates Navet uses itself, and opens them again.
 * The calendar is selectable, so the arrow keys move between the dates; the selected date is the
 * one being edited.
 */
export function SemesterDates({
	dates,
	locked,
}: Readonly<{ dates: SemesterDate[]; locked: boolean }>) {
	const [openDate, setOpenDate] = useState<string | null>(null);
	const byDate = new Map(dates.map((date) => [date.date, date]));
	const sorted = [...byDate.keys()].sort();
	const first = sorted[0];
	const last = sorted.at(-1);
	if (first === undefined || last === undefined) return null;

	const firstDay = toDay(first);
	return (
		<SemesterDatesContext.Provider value={{ byDate, locked, openDate, setOpenDate }}>
			<Calendar
				mode="single"
				selected={openDate ? toDay(openDate) : undefined}
				onSelect={(day) => setOpenDate(day ? format(day, ISO_DAY) : null)}
				month={firstDay}
				numberOfMonths={differenceInCalendarMonths(toDay(last), firstDay) + 1}
				hideNavigation
				disableNavigation
				showOutsideDays={false}
				ISOWeek
				locale={nb}
				disabled={(day) => locked || !byDate.has(format(day, ISO_DAY))}
				formatters={{
					formatCaption: (month) => capitalize(format(month, "LLLL", { locale: nb })),
					formatWeekdayName: (weekday) => format(weekday, "EEEEE", { locale: nb }),
				}}
				className="w-full bg-transparent p-0"
				classNames={{
					root: "w-full",
					months: "grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-4",
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
				components={{ DayButton: DateButton, Month: MonthWithClosedDates }}
			/>
		</SemesterDatesContext.Provider>
	);
}

/** One month, with the reasons for its closed dates listed under the calendar. */
function MonthWithClosedDates({
	calendarMonth,
	displayIndex: _displayIndex,
	children,
	...props
}: MonthProps) {
	const { byDate } = useContext(SemesterDatesContext);
	const month = format(calendarMonth.date, "yyyy-MM");
	const closed = [...byDate.values()]
		.filter((day) => day.date.startsWith(month) && day.closedLabel !== undefined)
		.sort((a, b) => a.date.localeCompare(b.date));

	return (
		<div {...props}>
			{children}
			{closed.length > 0 && (
				<ul className="mt-2 grid gap-0.5 text-muted-foreground text-xs leading-snug">
					{closed.map((day) => (
						<li key={day._id} className="flex gap-1.5">
							<span className="shrink-0 tabular-nums">
								{capitalize(formatSemesterDay(day.date, "weekdayDay"))}
							</span>
							<span className="min-w-0 truncate text-foreground/80">
								{closedDateLabel(day.closedLabel ?? "")}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** A day in the calendar: a semester date opens its popover, any other day is just a number. */
function DateButton({
	day,
	modifiers: _modifiers,
	className: _className,
	...props
}: DayButtonProps) {
	const { byDate } = useContext(SemesterDatesContext);
	const semesterDate = byDate.get(day.isoDate);
	if (!semesterDate) {
		return (
			<span aria-hidden className={cn(CELL, "text-muted-foreground/60")}>
				{day.date.getDate()}
			</span>
		);
	}
	return <DateCell day={semesterDate} buttonProps={props} />;
}

function DateCell({
	day,
	buttonProps,
}: Readonly<{
	day: SemesterDate;
	/** Focus, keyboard and selection handling from the calendar. */
	buttonProps: Omit<DayButtonProps, "day" | "modifiers">;
}>) {
	const { locked, openDate, setOpenDate } = useContext(SemesterDatesContext);
	const setDateClosed = useMutation(api.semesterPlanning.semesters.mutations.setDateClosed);
	const [label, setLabel] = useState("");
	const [error, setError] = useState<string>();
	const [saving, setSaving] = useState<"close" | "open">();
	const open = openDate === day.date;
	const isClosed = day.closedLabel !== undefined;
	const fullDay = capitalize(longDay(day.date));
	const reasonText = day.closedLabel?.trim();
	const state = !isClosed ? "åpen" : reasonText ? `stengt: ${reasonText}` : "stengt";

	const setOpen = (next: boolean) => {
		if (next) setLabel(day.closedLabel ?? "");
		setError(undefined);
		setOpenDate(next ? day.date : null);
	};

	async function save(next: string | null) {
		const dayName = shortDay(day.date);
		setSaving(next === null ? "open" : "close");
		setError(undefined);
		try {
			await setDateClosed({ dateId: day._id, label: next });
			const reason = next?.trim();
			if (next === null) toast.success(`${capitalize(dayName)} er åpnet igjen.`);
			else if (isClosed) toast.success(`Grunnen for ${dayName} er lagret.`);
			else toast.success(`${capitalize(dayName)} er stengt${reason ? ` («${reason}»)` : ""}.`);
			setOpenDate(null);
		} catch (caught) {
			setError(convexErrorMessage(caught, "Kunne ikke endre datoen. Prøv igjen."));
		} finally {
			setSaving(undefined);
		}
	}

	const unchanged = isClosed && label.trim() === (day.closedLabel ?? "");

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					{...buttonProps}
					type="button"
					disabled={locked}
					title={isClosed ? closedDateLabel(day.closedLabel ?? "") : undefined}
					aria-label={`${fullDay}, ${state}`}
					className={cn(
						CELL,
						"outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
						isClosed ? CLOSED_DATE : OPEN_DATE,
						open && "ring-2 ring-foreground/70",
					)}
				>
					{Number(day.date.slice(8))}
				</button>
			</PopoverTrigger>
			<PopoverContent align="center" className="w-72">
				<form
					className="grid gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						void save(label);
					}}
				>
					<div>
						<p className="font-semibold text-sm">{isClosed ? "Stengt dato" : "Steng dato"}</p>
						<p className="text-muted-foreground text-xs">{fullDay}</p>
					</div>
					<div className="grid gap-1.5">
						<label htmlFor={`reason-${day._id}`} className="font-medium text-sm">
							Intern grunn (valgfritt)
						</label>
						<Input
							id={`reason-${day._id}`}
							autoFocus
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							aria-invalid={error !== undefined}
						/>
					</div>
					{error && (
						<p role="alert" className="font-medium text-destructive text-sm">
							{error}
						</p>
					)}
					{isClosed ? (
						<div className="flex justify-between gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={saving !== undefined}
								onClick={() => void save(null)}
							>
								{saving === "open" ? "Åpner …" : "Åpne igjen"}
							</Button>
							<Button type="submit" size="sm" disabled={saving !== undefined || unchanged}>
								{saving === "close" ? "Lagrer …" : "Lagre"}
							</Button>
						</div>
					) : (
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
								Avbryt
							</Button>
							<Button type="submit" size="sm" disabled={saving !== undefined}>
								{saving === "close" ? "Stenger …" : "Steng"}
							</Button>
						</div>
					)}
				</form>
			</PopoverContent>
		</Popover>
	);
}
