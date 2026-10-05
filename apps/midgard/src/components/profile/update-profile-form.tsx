"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, refineStudentProfile, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { StudentProfileFields } from "@workspace/ui/components/student-profile-fields";
import { cn } from "@workspace/ui/lib/utils";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z
	.object({
		firstname: z.string().min(2, "Vennligst oppgi fornavnet ditt."),
		lastname: z.string().min(2, "Vennligst oppgi etternavnet ditt."),
		studyProgram: z.enum(STUDY_PROGRAMS),
		degree: z.enum(DEGREE_TYPES),
		year: z
			.number()
			.int()
			.min(1, "Vennligst oppgi året du går")
			.max(5, "5. året er maks, går du høyre en siste år master sett 5."),
	})
	.superRefine(refineStudentProfile);
export type ProfileFormSchema = z.infer<typeof formSchema>;

export default function UpdateProfileForm({
	preloadedStudent,
	className,
}: Readonly<{
	preloadedStudent: Preloaded<typeof api.users.students.queries.getCurrent>;
	className?: string;
}>) {
	const student = usePreloadedQuery(preloadedStudent);
	if (!student) throw new Error("Studentprofilen finnes ikke.");

	const updateProfile = useMutation(api.users.students.mutations.updateCurrent);
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
		onSubmit: ({ value }) =>
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

				<form.Field name="studyProgram">
					{(studyProgram) => (
						<form.Field name="degree">
							{(degree) => (
								<form.Field name="year">
									{(year) => (
										<StudentProfileFields studyProgram={studyProgram} degree={degree} year={year} />
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
			</FieldSet>
			<Button type="submit" className="text-primary-foreground">
				Oppdater profil
			</Button>
		</form>
	);
}
