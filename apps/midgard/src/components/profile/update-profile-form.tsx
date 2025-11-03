"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldContent,
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
import { cn } from "@workspace/ui/lib/utils";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	firstname: z.string().min(2, "Vennligst oppgi fornavnet ditt."),
	lastname: z.string().min(2, "Vennligst oppgi etternavnet ditt."),
	studyProgram: z.enum(STUDY_PROGRAMS),
	degree: z.enum(DEGREE_TYPES),
	year: z
		.number()
		.int()
		.min(1, "Vennligst oppgi året du går")
		.max(5, "5. året er maks, går du høyre en siste år master sett 5."),
});
export type ProfileFormSchema = z.infer<typeof formSchema>;

export default function UpdateProfileForm({
	preloadedStudent,
	className,
}: {
	preloadedStudent: Preloaded<typeof api.students.getCurrent>;
	className?: string;
}) {
	const student = usePreloadedQuery(preloadedStudent);

	const updateProfile = useMutation(api.students.updateCurrent);
	const form = useForm({
		defaultValues: {
			firstname: student.firstName,
			lastname: student.lastName,
			studyProgram: student.studyProgram as ProfileFormSchema["studyProgram"],
			degree: student.degree as ProfileFormSchema["degree"],
			year: student.year,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) =>
			updateProfile({
				studyProgram: value.studyProgram,
				degree: value.degree,
				year: value.year,
			})
				.then(() => {
					toast.success("Profilen ble oppdatert!");
				})
				.catch(() => {
					toast.error("Oi! Det oppstod en feil! Prøv igjen senere.");
				}),
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className={cn(className, "space-y-8")}
		>
			<FieldSet>
				<FieldGroup className="flex flex-col gap-4 md:flex-row">
					<form.Field name="firstname">
						{(field) => {
							return (
								<Field className="min-w-0 md:w-full">
									<FieldLabel htmlFor={field.name}>Fornavn</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										placeholder="Ola"
										disabled
										className="truncate"
										autoComplete="off"
									/>
								</Field>
							);
						}}
					</form.Field>
					<form.Field name="lastname">
						{(field) => {
							return (
								<Field className="min-w-0 md:w-full">
									<FieldLabel htmlFor={field.name}>Etternavn</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										placeholder="Nordmann"
										disabled
										className="truncate"
										autoComplete="off"
									/>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="studyProgram">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field className="w-full" data-invalid={isInvalid}>
									<FieldContent>
										<FieldLabel htmlFor={field.name}>Studieprogram</FieldLabel>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</FieldContent>
									<Select
										onValueChange={(value) =>
											field.handleChange(
												value as ProfileFormSchema["studyProgram"],
											)
										}
										value={field.state.value}
									>
										<SelectTrigger
											className="w-full truncate"
											aria-invalid={isInvalid}
										>
											<SelectValue
												placeholder="Velg et studieprogram"
												className="truncate"
											/>
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
					</form.Field>
				</FieldGroup>
				<FieldGroup className="flex w-full flex-col gap-4 md:flex-row">
					<form.Field name="degree">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field className="w-full" data-invalid={isInvalid}>
									<FieldContent>
										<FieldLabel htmlFor={field.name}>Grad</FieldLabel>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</FieldContent>
									<Select
										onValueChange={(value) =>
											field.handleChange(value as ProfileFormSchema["degree"])
										}
										value={field.state.value}
									>
										<SelectTrigger
											className="w-full truncate"
											aria-invalid={isInvalid}
										>
											<SelectValue
												placeholder="Velg studie grad"
												className="truncate"
											/>
										</SelectTrigger>
										<SelectContent>
											{DEGREE_TYPES.map((degree) => (
												<SelectItem key={degree} value={degree}>
													{degree}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							);
						}}
					</form.Field>
					<form.Field name="year">
						{(field) => {
							return (
								<Field className="w-full min-w-0">
									<FieldLabel htmlFor={field.name}>År</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => {
											const numeric = e.target.value.replaceAll(/\D/g, "");
											field.handleChange(Number.parseInt(numeric));
										}}
										type="number"
										min={1}
										max={5}
										className="truncate"
										autoComplete="off"
									/>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
			</FieldSet>
			<Button type="submit" className="text-primary-foreground">
				Oppdater profil
			</Button>
		</form>
	);
}
