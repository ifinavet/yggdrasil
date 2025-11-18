"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { toast } from "sonner";
import { z } from "zod/v4";

const formSchema = z.object({
	firstName: z.string().min(2, "Studenten må ha et fornavn"),
	lastName: z.string().min(2, "Studenten må ha et etternavn"),
	email: z.email("Studenten må ha en gyldig e-postadresse"),
	studyProgram: z.enum(STUDY_PROGRAMS, "Studenten må ha et studieprogram"),
	year: z.number().min(1, "Studenten må gå hvertfall 1. året"),
	degree: z.enum(DEGREE_TYPES, "Studenten må ha en gyldig grad"),
});

export default function UpdateStudentForm({
	preloadedStudent,
}: Readonly<{
	preloadedStudent: Preloaded<typeof api.students.getById>;
}>) {
	const student = usePreloadedQuery(preloadedStudent);

	const updateStudent = useMutation(api.students.update);

	const form = useForm({
		defaultValues: {
			firstName: student.firstName,
			lastName: student.lastName,
			year: student.year,
			email: student.email,
			studyProgram: student.studyProgram as (typeof STUDY_PROGRAMS)[number],
			degree: student.degree as (typeof DEGREE_TYPES)[number],
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			updateStudent({
				id: student.id,
				year: value.year,
				studyProgram: value.studyProgram as (typeof STUDY_PROGRAMS)[number],
				degree: value.degree as (typeof DEGREE_TYPES)[number],
			})
				.then(() => {
					toast.success("Student updated successfully");
				})
				.catch((error: Error) => {
					toast.error(error instanceof Error ? error.message : "Unknown error");
				});
		},
	});

	return (
		<form
			className="max-w-5xl space-y-8"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldSet>
				<FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<form.Field name="firstName">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Fornavn</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Ola"
										disabled
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="lastName">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Etternavn</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Nordmann"
										disabled
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<form.Field name="email">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>E-post</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
									placeholder="eks. olanord@uio.no"
									disabled
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<FieldGroup className="flex flex-wrap gap-4">
					<form.Field name="year">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>År</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										min={1}
										max={5}
										value={field.state.value}
										onChange={(e) =>
											field.handleChange(Number.parseInt(e.target.value, 10))
										}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="studyProgram">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Studieprogram</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(
												value as (typeof STUDY_PROGRAMS)[number],
											)
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Velg et studieprogram" />
										</SelectTrigger>
										<SelectContent>
											{STUDY_PROGRAMS.map((program) => (
												<SelectItem key={program} value={program}>
													{program}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="degree">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Studiegrad</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(value as (typeof DEGREE_TYPES)[number])
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Velg studie grad" />
										</SelectTrigger>
										<SelectContent>
											{DEGREE_TYPES.map((degree) => (
												<SelectItem key={degree} value={degree}>
													{degree}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" className="mt-4" disabled={form.state.isSubmitting}>
				{form.state.isSubmitting ? "Oppdaterer..." : "Oppdater"}
			</Button>
		</form>
	);
}
