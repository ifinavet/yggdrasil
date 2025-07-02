"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { DEGREE_TYPES } from "@/constants/degree-types";
import { STUDY_PROGRAMS } from "@/constants/study-program-types";
import { getStudentById, updateStudent } from "@/lib/queries/users/students";
import { zodv4Resolver } from "@/utils/zod-v4-resolver";

const formSchema = z.object({
	firstName: z.string().min(2, "Studenten må ha et fornavn"),
	lastName: z.string().min(2, "Studenten må ha et etternavn"),
	email: z.email("Studenten må ha en gyldig e-postadresse"),
	studyProgram: z.string().min(2, "Studenten må ha et studieprogram"),
	semester: z.number().min(1, "Studenten må ha et semester"),
	degree: z.string().min(2, "Studenten må ha en assosiert grad"),
});

export default function UpdateStudentForm({ user_id }: { user_id: string }) {
	const {
		data: student,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["student", user_id],
		queryFn: () => getStudentById(user_id),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodv4Resolver(formSchema),
		defaultValues: {
			firstName: student?.firstName || "",
			lastName: student?.lastName || "",
			semester: student?.semester || 1,
			email: student?.email || "",
			studyProgram: student?.studyProgram || undefined,
			degree: student?.degree || "",
		},
	});

	const { mutate } = useMutation({
		mutationFn: (formData: z.infer<typeof formSchema>) =>
			updateStudent(user_id, {
				firstName: formData.firstName,
				lastName: formData.lastName,
				semester: formData.semester,
				studyProgram: formData.studyProgram,
				degree: formData.degree,
			}),
		onSuccess: () => {
			toast.success("Student updated successfully");
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Unknown error");
		},
	});

	const handleSubmit = (values: z.infer<typeof formSchema>) => {
		mutate(values);
	};

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {error instanceof Error ? error.message : "Unknown error"}</div>;

	return (
		<Form {...form}>
			<form className='space-y-8' onSubmit={form.handleSubmit(handleSubmit)}>
				<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
					<FormField
						control={form.control}
						name='firstName'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Fornavn</FormLabel>
								<FormControl>
									<Input placeholder='Ola' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name='lastName'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Etternavn</FormLabel>
								<FormControl>
									<Input placeholder='Nordmann' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name='email'
					render={({ field }) => (
						<FormItem>
							<FormLabel>E-post</FormLabel>
							<FormControl>
								<Input placeholder='eks. olanord@uio.no' disabled {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name='semester'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Semester</FormLabel>
							<FormControl>
								<Input type='number' min={1} max={10} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
					<FormField
						control={form.control}
						name='studyProgram'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Studieprogram</FormLabel>
								<FormControl>
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger>
											<SelectValue placeholder='Velg et studieprogram' />
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

					<FormField
						control={form.control}
						name='degree'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Studieprogram</FormLabel>
								<FormControl>
									<Select onValueChange={field.onChange} value={field.value}>
										<SelectTrigger>
											<SelectValue placeholder='Velg studie grad' />
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
				</div>

				<Button type='submit' className='mt-4'>
					Oppdater
				</Button>
			</form>
		</Form>
	);
}
