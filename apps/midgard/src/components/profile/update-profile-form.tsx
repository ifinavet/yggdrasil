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
import { DEGREE_TYPES } from "@/constants/degree-types";
import { STUDY_PROGRAMS } from "@/constants/study-program-types";
import { zodv4Resolver } from "@/uitls/zod-v4-resolver";

const formSchema = z.object({
  firstname: z.string().min(2, "Vennligst oppgi fornavnet ditt."),
  lastname: z.string().min(2, "Vennligst oppgi etternavnet ditt."),
  studyProgram: z.enum(STUDY_PROGRAMS as [string, ...string[]]),
  degree: z.enum(DEGREE_TYPES as [string, ...string[]]),
  semester: z.number().min(1).max(10),
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
    resolver: zodv4Resolver(formSchema),
    defaultValues: {
      firstname: student.firstName,
      lastname: student.lastName,
      studyProgram: student.studyProgram,
      degree: student.degree,
      semester: student.semester,
    },
  });

  const updateProfile = useMutation(api.students.updateCurrent);
  const onSubmit = async (values: ProfileFormSchema) => updateProfile({
    semester: values.semester,
    studyProgram: values.studyProgram,
    degree: values.degree as "bachelor" | "master" | "phd",
  }).then(() => {
    toast.success("Profilen ble oppdatert!");
  }).catch(() => {
    toast.error("Oi! Det oppstod en feil! Prøv igjen senere.");
  })

  if (!student) return <div>Loading...</div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn(className, "space-y-8")}>
        <div className='flex flex-col gap-4 md:flex-row'>
          <FormField
            control={form.control}
            name='firstname'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Fornavn</FormLabel>
                <FormControl>
                  <Input placeholder='Ola' {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='lastname'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Etternavn</FormLabel>
                <FormControl>
                  <Input placeholder='Nordmann' {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='studyProgram'
          render={({ field }) => (
            <FormItem className='w-full'>
              <FormLabel>Studieprogram</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className='w-full'>
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

        <div className='flex w-full flex-col gap-4 md:flex-row'>
          <FormField
            control={form.control}
            name='degree'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Studiegrad</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Velg studie grad' />
                    </SelectTrigger>
                    <SelectContent>
                      {DEGREE_TYPES.map((degree) => (
                        <SelectItem key={degree} value={degree.toLowerCase()}>
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
            name='semester'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Semester</FormLabel>
                <FormControl>
                  <Input type='number' min={1} max={10} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type='submit'>Oppdater profil</Button>
      </form>
    </Form>
  );
}
