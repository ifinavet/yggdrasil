"use client";

import {
	type Degree,
	degreesFor,
	fittingDegree,
	fittingYear,
	STUDY_PROGRAMS,
	yearsFor,
} from "@workspace/shared/constants";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useId } from "react";

type ProfileField<T> = {
	state: {
		value: T;
		meta?: { isTouched: boolean; errors: Array<{ message?: string } | undefined> };
	};
	handleChange: (value: T) => void;
	handleBlur?: () => void;
};

export function StudentProfileFields<T extends string>({
	studyProgram,
	degree,
	year,
}: Readonly<{
	studyProgram: ProfileField<T>;
	degree: ProfileField<Degree>;
	year: ProfileField<number>;
}>) {
	const id = useId();
	const fields = [
		{
			key: "program",
			label: "Studieprogram",
			field: studyProgram,
			options: STUDY_PROGRAMS,
			change: (value: string) => {
				const nextDegree = fittingDegree(value, degree.state.value);
				studyProgram.handleChange(value as T);
				degree.handleChange(nextDegree);
				year.handleChange(fittingYear(nextDegree, year.state.value));
			},
		},
		{
			key: "degree",
			label: "Grad",
			field: degree,
			options: degreesFor(studyProgram.state.value),
			change: (value: string) => {
				const nextDegree = value as Degree;
				degree.handleChange(nextDegree);
				year.handleChange(fittingYear(nextDegree, year.state.value));
			},
		},
		{
			key: "year",
			label: "Studieår",
			field: year,
			options: yearsFor(degree.state.value),
			change: (value: string) => year.handleChange(Number(value)),
		},
	];
	return (
		<div className="grid min-w-0 gap-5 sm:grid-cols-2">
			{fields.map(({ key, label, field, options, change }) => {
				const errors = field.state.meta?.isTouched ? field.state.meta.errors : [];
				const invalid = Boolean(errors?.length);
				return (
					<Field
						key={key}
						data-invalid={invalid}
						className={key === "program" ? "sm:col-span-2" : undefined}
					>
						<FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
						<Select key={options.join()} value={String(field.state.value)} onValueChange={change}>
							<SelectTrigger
								id={`${id}-${key}`}
								className="w-full"
								aria-invalid={invalid}
								onBlur={field.handleBlur}
								aria-describedby={invalid ? `${id}-${key}-error` : undefined}
							>
								<SelectValue placeholder="Velg" />
							</SelectTrigger>
							<SelectContent>
								{options.map((option) => (
									<SelectItem key={option} value={String(option)}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{invalid && <FieldError id={`${id}-${key}-error`} errors={errors} />}
					</Field>
				);
			})}
		</div>
	);
}
