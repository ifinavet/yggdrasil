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

/**
 * A date button with a calendar popover. The value is a "YYYY-MM-DD" day or "" when nobody has
 * picked one yet; it never falls back to a default date.
 */
export function DatePicker({
	id,
	value,
	onChange,
	onBlur,
	disabled,
	invalid,
}: Readonly<{
	id: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	disabled?: boolean;
	invalid?: boolean;
}>) {
	const [open, setOpen] = useState(false);
	const selected = value ? parse(value, ISO_DAY, new Date()) : undefined;

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
