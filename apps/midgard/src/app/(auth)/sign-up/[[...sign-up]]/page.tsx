"use client";

import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { DEGREE_TYPES } from "@/constants/degree-types";
import { STUDY_PROGRAMS } from "@/constants/study-program-types";
import { zodv4Resolver } from "@/uitls/zod-v4-resolver";
import { useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { Button } from "@workspace/ui/components/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@workspace/ui/components/form";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@workspace/ui/components/select";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod/v4";
import { Card } from "@workspace/ui/components/card";
import { Title } from "@/components/common/title";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@workspace/backend/convex/api";

const signUpFormSchema = z.object({
  firstName: z.string().min(1, "Fornavn er påkrevd"),
  lastName: z.string().min(1, "Etternavn er påkrevd"),
  email: z.email().regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)*uio\.no$|^[A-Za-z0-9._%+-]+@ifinavet\.no$/, "E-post må være en gyldig uio e-postadresse"),
  password: z.string().min(6, "Passord må være minst 8 tegn"),
  confirmPassword: z.string().min(6, "Bekreft passord må være minst 8 tegn"),
  studyProgram: z.enum(STUDY_PROGRAMS),
  degree: z.enum(DEGREE_TYPES),
  semester: z.coerce.number().min(1).max(10),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passordene må være like",
  path: ["confirmPassword"],
})

const verifyingSchema = z.object({
  code: z.string().min(6, "Verifiseringskode må være 6 tegn"),
});

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();

  const [errors, setErrors] = useState<ClerkAPIError[]>([]);
  const [verifying, setVerifying] = useState(false);

  const router = useRouter();

  const signUpForm = useForm<z.infer<typeof signUpFormSchema>>({
    resolver: zodv4Resolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      studyProgram: STUDY_PROGRAMS[0],
      degree: DEGREE_TYPES[0],
      semester: 1,
    }
  })

  const verifyingForm = useForm<z.infer<typeof verifyingSchema>>({
    resolver: zodv4Resolver(verifyingSchema),
    defaultValues: {
      code: "",
    }
  });

  const onSignUpSubmit = async (data: z.infer<typeof signUpFormSchema>) => {
    if (!isLoaded) return;

    try {
      await signUp.create({
        firstName: data.firstName,
        lastName: data.lastName,
        emailAddress: data.email,
        password: data.password,
      })

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setVerifying(true);
    } catch (error) {
      if (isClerkAPIResponseError(error)) setErrors(error.errors);
    }
  };

  const createStudent = useMutation(api.students.createByExternalId)
  const onVerifyingSubmit = async (data: z.infer<typeof verifyingSchema>) => {
    if (!isLoaded) return;

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: data.code,
      });

      if (signUpAttempt.status === "complete") {

        await setActive({
          session: signUpAttempt.createdSessionId,
        });

        if (signUpAttempt.createdUserId === null) {
          setErrors([
            {
              code: "user_creation_failed",
              longMessage: "Bruker kunne ikke opprettes. Vennligst prøv igjen.",
              meta: {},
            } as ClerkAPIError
          ]);
          return;
        }

        await createStudent({
          externalId: signUpAttempt.createdUserId,
          studyProgram: signUpForm.getValues("studyProgram"),
          degree: signUpForm.getValues("degree"),
          semester: signUpForm.getValues("semester"),
          name: `${signUpForm.getValues("firstName")} ${signUpForm.getValues("lastName")}`,
        });

        router.push("/")
      } else {
        setErrors([
          {
            code: "verification_failed",
            longMessage: "Verifisering mislyktes. Vennligst prøv igjen.",
            meta: {},
          } as ClerkAPIError
        ]);
        console.error("Verification failed", signUpAttempt);
      }
    } catch (error) {
      if (isClerkAPIResponseError(error)) setErrors(error.errors);
    }
  };

  if (verifying) {
    return (
      <ResponsiveCenterContainer className="!max-w-3xl h-full">
        <Title>Opprett ny Bruker</Title>
        <div className="grid place-content-center h-3/5">
          <Card className="p-8 w-fit">
            <Form {...verifyingForm}>
              <form onSubmit={verifyingForm.handleSubmit(onVerifyingSubmit)} className="w-full space-y-6">
                <FormField
                  control={verifyingForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verifiserings kode</FormLabel>
                      <FormControl>
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormDescription>
                        Skriv in koden du har fått på e-post for å verifisere brukeren din.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                <Button type="submit">
                  Fullfør oppretting
                </Button>
              </form>
            </Form>
          </Card>
        </div>
      </ResponsiveCenterContainer >
    )
  }

  return (
    <ResponsiveCenterContainer className="">
      <Title>Opprett ny Bruker</Title>
      <Form {...signUpForm}>
        <form onSubmit={signUpForm.handleSubmit(onSignUpSubmit)} className="space-y-8 !max-w-3xl mx-auto">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={signUpForm.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornavn</FormLabel>
                  <Input
                    {...field}
                    placeholder="Fornavn"
                    className="w-full"
                  />
                  <FormMessage />
                </FormItem>
              )} />

            <FormField
              control={signUpForm.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etternavn</FormLabel>
                  <Input
                    {...field}
                    placeholder="Etternavn"
                    className="w-full"
                  />
                  <FormMessage />
                </FormItem>
              )} />
          </div>

          <FormField
            control={signUpForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Epost</FormLabel>
                <Input
                  {...field}
                  placeholder="eks. olanor@uio.no"
                  className="w-full"
                />
                <FormMessage />
              </FormItem>
            )} />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={signUpForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passord</FormLabel>
                  <Input
                    {...field}
                    placeholder="Passord"
                    type="password"
                    className="w-full"
                  />
                  <FormMessage />
                </FormItem>
              )} />

            <FormField
              control={signUpForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bekreft passord</FormLabel>
                  <Input
                    {...field}
                    placeholder="Bekreft passord"
                    type="password"
                    className="w-full"
                  />
                  <FormMessage />
                </FormItem>
              )} />
          </div>

          <FormField
            control={signUpForm.control}
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

          <FormField
            control={signUpForm.control}
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
            control={signUpForm.control}
            name='semester'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Semester</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={10}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div id="clerk-captcha"></div>

          {errors && errors.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-destructive text-sm">
              {errors.map((error, idx) => (
                <li key={idx}>
                  {error.longMessage}
                </li>
              ))}
            </ul>
          )}

          <Button type="submit">
            Opprett ny bruker
          </Button>
        </form>
      </Form>
    </ResponsiveCenterContainer>
  );
}
