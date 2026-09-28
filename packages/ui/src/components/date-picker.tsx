"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { format, parse } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

const ISO_DAY = "yyyy-MM-dd";

// The years the month and year dropdowns offer. Without an end, the calendar stops at this year,
// which makes a date next year impossible to pick.
const YEARS_BACK = 10;
const YEARS_AHEAD = 5;

/**
 * A date button with a calendar popover. The value is a "YYYY-MM-DD" day or "" when nobody has
 * picked one yet; it never falls back to a default date. The year dropdown reaches a few years
 * ahead, so dates for coming semesters can be picked.
 */
export function DatePicker({
	id,
	value,
	onChange,
	onBlur,
	disabled,
	invalid,
	yearsAhead = YEARS_AHEAD,
}: Readonly<{
	id: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	disabled?: boolean;
	invalid?: boolean;
	/** How many years past this one the year dropdown offers. */
	yearsAhead?: number;
}>) {
	const [open, setOpen] = useState(false);
	const selected = value ? parse(value, ISO_DAY, new Date()) : undefined;
	const thisYear = new Date().getFullYear();
	const startMonth = new Date(Math.min(thisYear - YEARS_BACK, selected?.getFullYear() ?? thisYear), 0);
	const endMonth = new Date(Math.max(thisYear + yearsAhead, selected?.getFullYear() ?? thisYear), 11);

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) onBlur?.();
			}}
		>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					disabled={disabled}
					aria-invalid={invalid}
					className={cn(
						"w-full justify-start gap-2 px-3 font-normal tabular-nums",
						!selected && "text-muted-foreground",
					)}
				>
					<CalendarIcon className="text-muted-foreground" />
					{selected ? format(selected, "dd.MM.yyyy") : "Velg dato"}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					ISOWeek
					locale={nb}
					captionLayout="dropdown"
					startMonth={startMonth}
					endMonth={endMonth}
					selected={selected}
					defaultMonth={selected}
					onSelect={(date) => {
						if (!date) return;
						onChange(format(date, ISO_DAY));
						setOpen(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
