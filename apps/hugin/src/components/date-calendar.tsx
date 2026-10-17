"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { type ComponentProps, useMemo } from "react";
import { FOCUS_RING, linkClass } from "@/components/form-controls";
import {
	calendarDay,
	calendarMonths,
	capitalize,
	semesterDay,
} from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";

/** Tuesday and Thursday, the days Navet usually holds company events, stand out in the calendar. */
const HIGHLIGHTED_WEEKDAYS = [2, 4];

type DayButtonProps = ComponentProps<
	NonNullable<NonNullable<ComponentProps<typeof Calendar>["components"]>["DayButton"]>
>;

/**
 * One day in the calendar. A chosen date fills with the primary colour, an open Tuesday or Thursday
 * is tinted, and a day that cannot be picked is only a number. An unchosen open date gets a red
 * border when the question is invalid, from `data-invalid` on the calendar's wrapper.
 */
function DayButton({ day, modifiers, className, ...props }: DayButtonProps) {
	return (
		<button
			{...props}
			className={cn(
				"grid h-10 w-full place-items-center rounded-lg border text-[14px] tabular-nums transition-[background-color,border-color,color] duration-150",
				FOCUS_RING,
				modifiers.disabled
					? "cursor-default border-transparent text-muted-foreground/60"
					: modifiers.selected
						? "border-primary bg-primary font-semibold text-primary-foreground"
						: cn(
								"cursor-pointer font-semibold group-data-[invalid=true]/dates:border-destructive",
								modifiers.highlighted
									? "border-primary/35 bg-primary-light text-primary hover:border-primary dark:bg-accent dark:text-accent-foreground"
									: "border-input bg-card hover:border-foreground/40",
							),
				className,
			)}
		/>
	);
}

/**
 * Every date the company can pick, in a calendar from the first to the last open month, for the
 * application form and for asking for another date on an offer. Hugin never says whether a date is
 * taken; dates that cannot be picked are not sent to the page at all, so they show as plain days.
 * With `max`, «Velg alle» is left out and the other dates are locked once that many are chosen.
 */
export function DateCalendar({
	dates,
	value,
	onChange,
	invalid,
	labelledBy,
	describedBy,
	max,
	onBlur,
}: Readonly<{
	dates: readonly string[];
	value: readonly string[];
	onChange: (dates: string[]) => void;
	invalid: boolean;
	labelledBy: string;
	describedBy?: string;
	max?: number;
	onBlur?: () => void;
}>) {
	const open = useMemo(() => new Set(dates), [dates]);
	const months = useMemo(() => calendarMonths(dates), [dates]);
	const chosen = new Set(value);
	const atLimit = max !== undefined && value.length >= max;

	return (
		<fieldset
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			onBlur={onBlur}
			className="m-0 min-w-0 border-0 p-0"
		>
			<div className="-mt-2 flex items-center justify-between gap-3 text-[13px] tabular-nums">
				<div className="-ml-2 flex">
					{max === undefined && (
						<DateAction
							disabled={value.length === dates.length}
							onClick={() => onChange([...dates])}
						>
							{COPY.dates.selectAll}
						</DateAction>
					)}
					<DateAction disabled={value.length === 0} onClick={() => onChange([])}>
						{COPY.dates.clear}
					</DateAction>
				</div>
				<span aria-live="polite">
					<b className="text-primary dark:text-primary-foreground">
						{COPY.dates.chosen(value.length, dates.length)}
					</b>
				</span>
			</div>

			{months && (
				<div data-invalid={invalid || undefined} className="group/dates mt-2">
					<Calendar
						mode="multiple"
						selected={value.map(calendarDay)}
						onSelect={(days) => {
							const next = new Set((days ?? []).map(semesterDay));
							onChange(dates.filter((date) => next.has(date)));
						}}
						month={months.first}
						numberOfMonths={months.count}
						hideNavigation
						disableNavigation
						showOutsideDays={false}
						ISOWeek
						locale={nb}
						disabled={(day) => {
							const date = semesterDay(day);
							return !open.has(date) || (atLimit && !chosen.has(date));
						}}
						modifiers={{ highlighted: { dayOfWeek: HIGHLIGHTED_WEEKDAYS } }}
						formatters={{
							formatCaption: (month) => capitalize(format(month, "LLLL yyyy", { locale: nb })),
							formatWeekdayName: (weekday) => capitalize(format(weekday, "EEEEEE", { locale: nb })),
						}}
						components={{ DayButton }}
						className="w-full bg-transparent p-0"
						classNames={{
							root: "w-full",
							months: "grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4",
							month: "flex flex-col gap-2 rounded-xl border border-border bg-card p-3",
							month_caption: "mb-1",
							caption_label: "font-semibold text-[13.5px] text-muted-foreground",
							weekdays: "grid grid-cols-7 gap-1",
							// Monday first, so Tuesday and Thursday are the 2nd and 4th columns.
							weekday:
								"text-center font-normal text-[12px] text-muted-foreground [&:nth-child(2)]:font-semibold [&:nth-child(2)]:text-primary [&:nth-child(4)]:font-semibold [&:nth-child(4)]:text-primary dark:[&:nth-child(2)]:text-primary-foreground dark:[&:nth-child(4)]:text-primary-foreground",
							week: "mt-1 grid grid-cols-7 gap-1",
							day: "p-0",
						}}
					/>
				</div>
			)}
		</fieldset>
	);
}

/**
 * «Velg alle» and «Nullstill valg»: small text buttons above the dates. One that would change
 * nothing is `aria-disabled` rather than `disabled`, so focus stays on it after a press.
 */
function DateAction({
	disabled,
	onClick,
	children,
}: Readonly<{ disabled: boolean; onClick: () => void; children: string }>) {
	return (
		<button
			type="button"
			aria-disabled={disabled || undefined}
			onClick={disabled ? undefined : onClick}
			className={cn(
				linkClass,
				FOCUS_RING,
				"min-h-11 whitespace-nowrap rounded-lg px-2 font-semibold text-[13px]",
				disabled && "cursor-default text-muted-foreground no-underline dark:text-muted-foreground",
			)}
		>
			{children}
		</button>
	);
}
