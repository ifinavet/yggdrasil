import { formatSemesterDay } from "@workspace/shared/semester/time";
import { cn } from "@workspace/ui/lib/utils";
import { useMemo } from "react";
import { CheckMark, ERROR_BORDER } from "@/components/form-controls";
import { dateCellParts, groupDatesByMonth, isTuesdayDate } from "@/lib/company-application-format";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";

function DateCell({
	date,
	checked,
	invalid,
	onToggle,
}: Readonly<{ date: string; checked: boolean; invalid: boolean; onToggle: () => void }>) {
	const { weekday, day } = dateCellParts(date);
	return (
		<label
			className={cn(
				"relative flex h-[46px] min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 font-semibold text-[14.5px] tabular-nums transition-[background-color,border-color,color] duration-150 active:scale-[0.98]",
				"has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-[color-mix(in_oklab,var(--ring)_55%,transparent)] has-[input:focus-visible]:outline-offset-2",
				checked
					? "border-primary bg-primary text-primary-foreground"
					: cn("bg-card", invalid ? ERROR_BORDER : "border-input"),
			)}
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={onToggle}
				aria-label={formatSemesterDay(date, "long")}
				className="sr-only"
			/>
			<CheckMark checked={checked} inverted className="size-[18px] rounded-[5px]" />
			<span className="truncate">
				{weekday}{" "}
				<small
					className={cn(
						"font-normal text-[13px]",
						checked ? "text-[oklch(0.88_0.02_274)]" : "text-muted-foreground",
					)}
				>
					{day}
				</small>
			</span>
		</label>
	);
}

/**
 * Every open date in the semester as a checkbox, by month and week. Hugin never says
 * whether a date is taken; closed dates are not sent to the page at all.
 */
export function DateGrid({
	dates,
	value,
	onChange,
	semesterLabel,
	invalid,
	labelledBy,
	describedBy,
}: Readonly<{
	dates: readonly string[];
	value: readonly string[];
	onChange: (dates: string[]) => void;
	semesterLabel: string;
	invalid: boolean;
	labelledBy: string;
	describedBy?: string;
}>) {
	const months = useMemo(() => groupDatesByMonth(dates), [dates]);
	const chosen = new Set(value);

	const toggle = (date: string) => {
		const next = new Set(chosen);
		if (next.has(date)) next.delete(date);
		else next.add(date);
		onChange(dates.filter((open) => next.has(open)));
	};

	return (
		<fieldset
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			className="m-0 min-w-0 border-0 p-0"
		>
			<div className="-mt-0.5 flex justify-between text-[13px] tabular-nums">
				<span className="text-muted-foreground">{semesterLabel}</span>
				<span aria-live="polite">
					<b className="text-primary dark:text-primary-foreground">
						{COPY.dates.chosen(value.length, dates.length)}
					</b>
				</span>
			</div>

			{months.map((month) => (
				<div key={month.key}>
					<p className="m-0 mt-3.5 mb-1.5 font-semibold text-[13px] text-muted-foreground">
						{month.label}
					</p>
					{month.weeks.map((week) => (
						<div
							key={`${month.key}-${week.week}`}
							className="mb-2 grid grid-cols-[52px_1fr_1fr] items-center gap-2 max-[359px]:grid-cols-[44px_1fr_1fr]"
						>
							<span className="text-[12.5px] text-muted-foreground tabular-nums">
								{COPY.dates.week(week.week)}
							</span>
							{week.days.length === 1 && !isTuesdayDate(week.days[0] ?? "") && <span aria-hidden />}
							{week.days.map((date, index) => (
								<div key={date} className={cn(index > 1 && index % 2 === 0 && "col-start-2")}>
									<DateCell
										date={date}
										checked={chosen.has(date)}
										invalid={invalid}
										onToggle={() => toggle(date)}
									/>
								</div>
							))}
						</div>
					))}
				</div>
			))}
		</fieldset>
	);
}
