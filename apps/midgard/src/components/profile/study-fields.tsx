"use client";

import {
	DEGREE_TYPES,
	DEGREE_YEARS,
	degreesFor,
	fittingDegree,
	fittingYear,
	STUDY_PROGRAMS,
} from "@workspace/shared/constants";
import {
	Field,
	FieldContent,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { z } from "zod";
import { withFieldGroup } from "@/lib/form";

export const studySchema = z.object({
	studyProgram: z.enum(STUDY_PROGRAMS),
	degree: z.enum(DEGREE_TYPES),
	year: z
		.number()
		.int()
		.min(1, "Vennligst oppgi året du går")
		.max(5, "5. året er maks, går du høyre en siste år master sett 5."),
});
export type StudyValues = z.infer<typeof studySchema>;

export const STUDY_FIELDS = {
	studyProgram: "studyProgram",
	degree: "degree",
	year: "year",
} as const;

export const StudyFields = withFieldGroup({
	defaultValues: {} as StudyValues,
	render: function Render({ group }) {
		return (
			<>
				<FieldGroup>
					<group.Field
						name="studyProgram"
						listeners={{
							onChange: ({ value }) => {
								const degree = fittingDegree(value, group.getFieldValue("degree"));
								group.setFieldValue("degree", degree);
								group.setFieldValue("year", fittingYear(degree, group.getFieldValue("year")));
							},
						}}
					>
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field className="w-full" data-invalid={isInvalid}>
									<FieldContent>
										<FieldLabel htmlFor={field.name}>Studieprogram</FieldLabel>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</FieldContent>
									<Select
										onValueChange={(value) =>
											field.handleChange(value as StudyValues["studyProgram"])
										}
										value={field.state.value}
									>
										<SelectTrigger className="w-full truncate" aria-invalid={isInvalid}>
											<SelectValue placeholder="Velg et studieprogram" className="truncate" />
										</SelectTrigger>
										<SelectContent>
											{STUDY_PROGRAMS.map((program) => (
												<SelectItem key={program} value={program}>
													{program}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							);
						}}
					</group.Field>
				</FieldGroup>
				<FieldGroup className="flex w-full flex-col gap-4 md:flex-row">
					<group.Field
						name="degree"
						listeners={{
							onChange: ({ value }) =>
								group.setFieldValue("year", fittingYear(value, group.getFieldValue("year"))),
						}}
					>
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field className="w-full" data-invalid={isInvalid}>
									<FieldContent>
										<FieldLabel htmlFor={field.name}>Grad</FieldLabel>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</FieldContent>
									<Select
										onValueChange={(value) => field.handleChange(value as StudyValues["degree"])}
										value={field.state.value}
									>
										<SelectTrigger className="w-full truncate" aria-invalid={isInvalid}>
											<SelectValue placeholder="Velg studie grad" className="truncate" />
										</SelectTrigger>
										<SelectContent>
											<group.Subscribe selector={(state) => state.values.studyProgram}>
												{(program) =>
													degreesFor(program).map((degree) => (
														<SelectItem key={degree} value={degree}>
															{degree}
														</SelectItem>
													))
												}
											</group.Subscribe>
										</SelectContent>
									</Select>
								</Field>
							);
						}}
					</group.Field>
					<group.Field name="year">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field className="w-full min-w-0" data-invalid={isInvalid}>
									<FieldContent>
										<FieldLabel htmlFor={field.name}>År</FieldLabel>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</FieldContent>
									<group.Subscribe selector={(state) => DEGREE_YEARS[state.values.degree]}>
										{({ first, last }) => (
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => {
													const numeric = e.target.value.replaceAll(/\D/g, "");
													field.handleChange(Number.parseInt(numeric, 10));
												}}
												type="number"
												min={first}
												max={last}
												className="truncate"
												aria-invalid={isInvalid}
												autoComplete="off"
											/>
										)}
									</group.Subscribe>
								</Field>
							);
						}}
					</group.Field>
				</FieldGroup>
			</>
		);
	},
});
