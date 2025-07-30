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
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { DEGREE_TYPES } from "@/constants/degree-types";
import { STUDY_PROGRAMS } from "@/constants/study-program-types";
import { zodv4Resolver } from "@/utils/zod-v4-resolver";

const formSchema = z.object({
  firstName: z.string().min(2, "Studenten må ha et fornavn"),
  lastName: z.string().min(2, "Studenten må ha et etternavn"),
  email: z.email("Studenten må ha en gyldig e-postadresse"),
  studyProgram: z.string().min(2, "Studenten må ha et studieprogram"),
  semester: z.number().min(1, "Studenten må ha et semester"),
  degree: z.string().min(2, "Studenten må ha en assosiert grad"),
});

export default function UpdateStudentForm({
  preloadedStudent,
}: {
  preloadedStudent: Preloaded<typeof api.students.getById>;
}) {
  const student = usePreloadedQuery(preloadedStudent);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodv4Resolver(formSchema),
    defaultValues: {
      firstName: student.firstName,
      lastName: student.lastName,
      semester: student.semester,
      email: student.email,
      studyProgram: student.studyProgram,
      degree: student.degree,
    },
  });

  const updateStudent = useMutation(api.students.update);
  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    updateStudent({
      id: student.id,
      semester: values.semester,
      studyProgram: values.studyProgram,
      degree: values.degree as "bachelor" | "master" | "phd",
    })
      .then(() => {
        toast.success("Student updated successfully");
      })
      .catch((error: Error) => {
        toast.error(error instanceof Error ? error.message : "Unknown error");
      });
  };

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
                  <Input placeholder='Ola' {...field} disabled />
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
                  <Input placeholder='Nordmann' {...field} disabled />
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
        </div>

        <Button type='submit' className='mt-4'>
          Oppdater
        </Button>
      </form>
    </Form>
  );
}
