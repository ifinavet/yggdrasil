"use client";

import { api } from "@workspace/backend/convex/api";
import { refineStudentProfile } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { toast } from "sonner";
import { z } from "zod";
import { STUDY_FIELDS, StudyFields, studySchema } from "@/components/profile/study-fields";
import { useAppForm } from "@/lib/form";

const formSchema = studySchema
	.extend({
		firstname: z.string().min(2, "Vennligst oppgi fornavnet ditt."),
		lastname: z.string().min(2, "Vennligst oppgi etternavnet ditt."),
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

	const updateProfile = useMutation(api.users.students.mutations.updateCurrent);
	const form = useAppForm({
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

				<StudyFields form={form} fields={STUDY_FIELDS} />
			</FieldSet>
			<Button type="submit" className="text-primary-foreground">
				Oppdater profil
			</Button>
		</form>
	);
}
