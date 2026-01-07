import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
export default function DateTimePicker({
	field,
	label,
	description,
}: Readonly<{
	field: {
		name: string;
		state: {
			value: Date | undefined;
			meta: {
				isTouched: boolean;
				isValid: boolean;
				errors: Array<{ message?: string } | undefined>;
			};
		};
		handleChange: (value: Date) => void;
		handleBlur: () => void;
	};
	label: string;
	description: string;
}>) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	const handleDateChange = (date: Date | undefined) => {
		if (date) {
			const currentDateTime = field.state.value || new Date();
			const newDateTime = new Date(date);
			newDateTime.setHours(currentDateTime.getHours());
			newDateTime.setMinutes(currentDateTime.getMinutes());
			newDateTime.setSeconds(currentDateTime.getSeconds());
			newDateTime.setMilliseconds(currentDateTime.getMilliseconds());
			field.handleChange(newDateTime);
		}
	};

	const handleTimeChange = (timeValue: string) => {
		if (timeValue) {
			const [hours, minutes] = timeValue.split(":").map(Number);
			if (hours !== undefined && minutes !== undefined) {
				const currentDateTime = field.state.value || new Date();
				const newDateTime = new Date(currentDateTime);
				newDateTime.setHours(hours);
				newDateTime.setMinutes(minutes);
				field.handleChange(newDateTime);
			}
		}
	};

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<div className="flex gap-6">
				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant={"outline"}
							className={cn(
								"w-60 pl-3 text-left font-normal",
								!field.state.value && "text-muted-foreground",
							)}
						>
							{field.state.value ? (
								format(field.state.value, "PPP", { locale: nb })
							) : (
								<span>Pick a date</span>
							)}
							<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="single"
							ISOWeek={true}
							locale={nb}
							selected={field.state.value}
							onSelect={handleDateChange}
							captionLayout="dropdown"
							startMonth={new Date(2020, 0)}
							endMonth={new Date(2050, 11)}
						/>
					</PopoverContent>
				</Popover>
				<Input
					type="time"
					lang="nb"
					id={field.name}
					name={field.name}
					value={field.state.value ? format(field.state.value, "HH:mm") : ""}
					onChange={(e) => handleTimeChange(e.target.value)}
					onBlur={field.handleBlur}
					aria-invalid={isInvalid}
					className="w-fit appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
				/>
			</div>
			<FieldDescription>{description}</FieldDescription>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
