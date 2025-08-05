"use client";

import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import { zodv4Resolver } from "@/uitls/zod-v4-resolver";
import { useSignIn } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { Button } from "@workspace/ui/components/button";
import { Form, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";

const signInSchema = z.object({
  email: z.email("Ugyldig e-postadresse"),
  password: z.string().min(8, "Passordet må være minst 8 tegn langt"),
})

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [error, setError] = useState<ClerkAPIError>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodv4Resolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const handleSignIn = async (data: z.infer<typeof signInSchema>) => {
    if (!isLoaded) return;

    try {
      const signInAttempt = await signIn.create({
        identifier: data.email,
        password: data.password,
      })

      if (signInAttempt.status === "complete") {
        setActive({ session: signInAttempt.createdSessionId });

        const redirectParam = searchParams.get("redirect");
        const redirectTo = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : "/";
        router.push(redirectTo);
      } else {
        setError(
          {
            code: "Sign in incomplete",
            longMessage: "Please complete the sign in process.",
            meta: {}
          } as ClerkAPIError
        );
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) setError(err.errors[0]);
    }
  }

  return (
    <ResponsiveCenterContainer>
      <Title>Logg inn</Title>
      <div className="md:w-3/5 md:mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-post</FormLabel>
                  <Input {...field} type="email" placeholder="olanord@uio.no" />
                  <FormDescription>
                    Skriv inn din UiO e-postadresse for å logge inn.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passord</FormLabel>
                  <Input {...field} type="password" />
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="text-destructive">
                {error.longMessage || "En feil oppstod under innlogging. Vennligst prøv igjen."}
              </div>
            )}

            <div className="flex flex-col items-start gap-4">
              <Button type="button" variant='link' asChild className="px-0">
                <Link href="/sign-up">
                  Ny student? Registrer deg her
                </Link>
              </Button>

              <Button type="submit" onClick={form.handleSubmit(handleSignIn)}>
                Logg inn
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </ResponsiveCenterContainer >
  )
}
