import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components/form";
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
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

export default function DateTimePicker<TFieldValues extends FieldValues>({
	form,
	fieldName,
	label,
	description,
}: Readonly<{
	form: UseFormReturn<TFieldValues>;
	fieldName: Path<TFieldValues>;
	label: string;
	description: string;
}>) {
	const handleDateChange = (
		date: Date | undefined,
		currentValue: Date | undefined,
		onChange: (value: Date) => void,
	) => {
		if (date) {
			const currentDateTime = currentValue || new Date();
			const newDateTime = new Date(date);
			newDateTime.setHours(currentDateTime.getHours());
			newDateTime.setMinutes(currentDateTime.getMinutes());
			newDateTime.setSeconds(currentDateTime.getSeconds());
			newDateTime.setMilliseconds(currentDateTime.getMilliseconds());
			onChange(newDateTime);
		}
	};

	const handleTimeChange = (
		timeValue: string,
		currentValue: Date | undefined,
		onChange: (value: Date) => void,
	) => {
		if (timeValue) {
			const [hours, minutes] = timeValue.split(":").map(Number);
			if (hours !== undefined && minutes !== undefined) {
				const currentDateTime = currentValue || new Date();
				const newDateTime = new Date(currentDateTime);
				newDateTime.setHours(hours);
				newDateTime.setMinutes(minutes);
				onChange(newDateTime);
			}
		}
	};

	return (
		<FormField
			control={form.control}
			name={fieldName}
			render={({ field }) => (
				<FormItem>
					<FormLabel>{label}</FormLabel>
					<div className="flex gap-6">
						<Popover>
							<PopoverTrigger asChild>
								<FormControl>
									<Button
										variant={"outline"}
										className={cn(
											"w-[240px] pl-3 text-left font-normal",
											!field.value && "text-muted-foreground",
										)}
									>
										{field.value ? (
											format(field.value, "PPP", { locale: nb })
										) : (
											<span>Pick a date</span>
										)}
										<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
									</Button>
								</FormControl>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									ISOWeek={true}
									locale={nb}
									selected={field.value}
									onSelect={(date) =>
										handleDateChange(date, field.value, field.onChange)
									}
									captionLayout="dropdown"
								/>
							</PopoverContent>
						</Popover>
						<Input
							type="time"
							lang="nb"
							value={field.value ? format(field.value, "HH:mm") : ""}
							onChange={(e) =>
								handleTimeChange(e.target.value, field.value, field.onChange)
							}
							className="w-fit appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
						/>
					</div>
					<FormDescription>{description}</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
