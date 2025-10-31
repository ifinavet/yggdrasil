"use client";

import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components/form";
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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { STUDY_PROGRAMS, DEGREE_TYPES } from "@workspace/shared/constants";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";

const formSchema = z.object({
	firstname: z.string().min(2, "Vennligst oppgi fornavnet ditt."),
	lastname: z.string().min(2, "Vennligst oppgi etternavnet ditt."),
	studyProgram: z.enum(STUDY_PROGRAMS),
	degree: z.enum(DEGREE_TYPES),
	year: z.coerce
		.number()
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

	const form = useForm<ProfileFormSchema>({
		resolver: zodV4Resolver(formSchema),
		defaultValues: {
			firstname: student.firstName,
			lastname: student.lastName,
			studyProgram: student.studyProgram as ProfileFormSchema["studyProgram"],
			degree: student.degree as ProfileFormSchema["degree"],
			year: student.year,
		},
	});

	const updateProfile = useMutation(api.students.updateCurrent);
	const onSubmit = async (values: ProfileFormSchema) =>
		updateProfile({
			year: values.year,
			studyProgram: values.studyProgram,
			degree: values.degree,
		})
			.then(() => {
				toast.success("Profilen ble oppdatert!");
			})
			.catch(() => {
				toast.error("Oi! Det oppstod en feil! Prøv igjen senere.");
			});

	if (!student) return <div>Loading...</div>;

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className={cn(className, "space-y-8")}
			>
				<div className="flex flex-col gap-4 md:flex-row">
					<FormField
						control={form.control}
						name="firstname"
						render={({ field }) => (
							<FormItem className="min-w-0 md:w-full">
								<FormLabel>Fornavn</FormLabel>
								<FormControl>
									<Input
										placeholder="Ola"
										{...field}
										disabled
										className="truncate"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="lastname"
						render={({ field }) => (
							<FormItem className="min-w-0 md:w-full">
								<FormLabel>Etternavn</FormLabel>
								<FormControl>
									<Input
										placeholder="Nordmann"
										{...field}
										disabled
										className="truncate"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="studyProgram"
					render={({ field }) => (
						<FormItem className="w-full">
							<FormLabel>Studieprogram</FormLabel>
							<FormControl>
								<Select onValueChange={field.onChange} value={field.value}>
									<SelectTrigger className="w-full truncate">
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
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex w-full flex-col gap-4 md:flex-row">
					<FormField
						control={form.control}
						name="degree"
						render={({ field }) => (
							<FormItem className="w-full min-w-0">
								<FormLabel>Studiegrad</FormLabel>
								<FormControl>
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger className="w-full truncate">
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
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="year"
						render={({ field }) => (
							<FormItem className="w-full min-w-0">
								<FormLabel>År</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={1}
										max={5}
										{...field}
										className="truncate"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<Button type="submit" className="text-primary-foreground">
					Oppdater profil
				</Button>
			</form>
		</Form>
	);
}
