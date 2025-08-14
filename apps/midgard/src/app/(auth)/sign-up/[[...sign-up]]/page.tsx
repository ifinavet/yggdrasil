"use client";

import { useAuth, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import type { ClerkAPIError } from "@clerk/types";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod/v4";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import { DEGREE_TYPES } from "@/constants/degree-types";
import { STUDY_PROGRAMS } from "@/constants/study-program-types";
import { zodv4Resolver } from "@/uitls/zod-v4-resolver";

const signUpFormSchema = z
  .object({
    firstName: z.string().min(1, "Fornavn er påkrevd"),
    lastName: z.string().min(1, "Etternavn er påkrevd"),
    email: z
      .email()
      .regex(
        /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)*uio\.no$|^[A-Za-z0-9._%+-]+@ifinavet\.no$/,
        "E-post må være en gyldig uio e-postadresse",
      ),
    password: z.string().min(6, "Passord må være minst 8 tegn"),
    confirmPassword: z.string().min(6, "Bekreft passord må være minst 8 tegn"),
    studyProgram: z.enum(STUDY_PROGRAMS),
    degree: z.enum(DEGREE_TYPES),
    semester: z.coerce.number().min(1).max(10),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passordene må være like",
    path: ["confirmPassword"],
  });

const verifyingSchema = z.object({
  code: z.string().min(6, "Verifiseringskode må være 6 tegn"),
});

export default function SignUpPage() {
  const { isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();
  const posthog = usePostHog();

  const [errors, setErrors] = useState<ClerkAPIError[]>([]);
  const [loading, setLoading] = useState(false);
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
    },
  });

  const verifyingForm = useForm<z.infer<typeof verifyingSchema>>({
    resolver: zodv4Resolver(verifyingSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSignUpSubmit = async (data: z.infer<typeof signUpFormSchema>) => {
    if (!isLoaded) return;

    try {
      setLoading(true);
      await signUp.create({
        firstName: data.firstName,
        lastName: data.lastName,
        emailAddress: data.email,
        password: data.password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setVerifying(true);
    } catch (error) {
      if (isClerkAPIResponseError(error)) setErrors(error.errors);
    } finally {
      setLoading(false);
    }
  };

  const createStudent = useMutation(api.students.createByExternalId);
  const onVerifyingSubmit = async (data: z.infer<typeof verifyingSchema>) => {
    if (!isLoaded) return;

    try {
      setLoading(true);
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
            } as ClerkAPIError,
          ]);
          return;
        }
        const semesterRaw = signUpForm.getValues("semester");
        const semester = typeof semesterRaw === "string" ? Number(semesterRaw) : semesterRaw;

        await createStudent({
          externalId: signUpAttempt.createdUserId,
          studyProgram: signUpForm.getValues("studyProgram"),
          degree: signUpForm.getValues("degree"),
          semester,
          name: `${signUpForm.getValues("firstName")} ${signUpForm.getValues("lastName")}`,
        });

        posthog.capture("midgard-student-sign-up", {
          name: `${signUpForm.getValues("firstName")} ${signUpForm.getValues("lastName")}`,
          email: signUpForm.getValues("email"),
          studyProgram: signUpForm.getValues("studyProgram"),
          degree: signUpForm.getValues("degree"),
          semester,
        });

        router.push("/");
      } else {
        setErrors([
          {
            code: "verification_failed",
            longMessage: "Verifisering mislyktes. Vennligst prøv igjen.",
            meta: {},
          } as ClerkAPIError,
        ]);
        console.error("Verification failed", signUpAttempt);
      }
    } catch (error) {
      if (isClerkAPIResponseError(error)) setErrors(error.errors);
    } finally {
      setLoading(false);
    }
  };

  if (isSignedIn) {
    router.push("/");
    return null;
  }

  if (verifying) {
    return (
      <ResponsiveCenterContainer className="!max-w-3xl h-full">
        <Title>Opprett ny Bruker</Title>
        <div className="grid h-3/5 place-content-center">
          <Card className="w-fit p-8">
            <Form {...verifyingForm}>
              <form
                onSubmit={verifyingForm.handleSubmit(onVerifyingSubmit)}
                className="w-full space-y-6"
              >
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
                  )}
                />
                <Button type="submit" disabled={loading}>
                  Fullfør oppretting
                </Button>
              </form>
            </Form>
          </Card>
        </div>
      </ResponsiveCenterContainer>
    );
  }

  return (
    <ResponsiveCenterContainer className="">
      <Title>Opprett ny Bruker</Title>
      <Form {...signUpForm}>
        <form
          onSubmit={signUpForm.handleSubmit(onSignUpSubmit)}
          className="!max-w-3xl mx-auto space-y-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={signUpForm.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornavn</FormLabel>
                  <Input {...field} placeholder="Fornavn" className="w-full" />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={signUpForm.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etternavn</FormLabel>
                  <Input {...field} placeholder="Etternavn" className="w-full" />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={signUpForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Epost</FormLabel>
                <Input {...field} placeholder="eks. olanor@uio.no" className="w-full" />
                <FormDescription>
                  Oppgi din UIO e-post adresse. Denne må være en gyldig (ifi.)uio.no e-post.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={signUpForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passord</FormLabel>
                  <Input {...field} placeholder="Passord" type="password" className="w-full" />
                  <FormDescription>Passordet må være minst 8 tegn langt.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormDescription>
                    Bekreft passordet ditt. Passordene må være like.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={signUpForm.control}
            name="studyProgram"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Studieprogram</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
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
                </FormControl>
                <FormDescription>Oppgi hvilket studieprogram du studerer.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={signUpForm.control}
            name="degree"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Studiegrad</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
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
                </FormControl>
                <FormDescription>
                  Oppgi hvilken grad du studerer. (Bachelor, Master, etc.)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={signUpForm.control}
            name="semester"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Semester</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={10} {...field} />
                </FormControl>
                <FormDescription>
                  Oppi hvilket semester du er på. (7. semester er 1. semster for master)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div id="clerk-captcha"></div>

          {errors && errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-destructive text-sm">
              {errors.map((error, idx) => (
                <li key={idx}>{error.longMessage}</li>
              ))}
            </ul>
          )}

          <small className="block font-medium text-sm leading-none">
            Når du registrerer en bruker på ifinavet.no så godtar du IFI-Navets{" "}
            <a href="/info/personvernerklaering" className="text-primary underline">
              personvernerklæring.
            </a>
          </small>

          <Button type="submit" disabled={loading}>
            Opprett ny bruker
          </Button>
        </form>
      </Form>
    </ResponsiveCenterContainer>
  );
}
