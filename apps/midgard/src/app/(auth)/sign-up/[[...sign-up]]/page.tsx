"use client";

import { useAuth, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import type { ClerkAPIError } from "@clerk/types";
import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
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
import z from "zod/v4";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";

const signUpFormSchema = z.object({
	firstName: z.string().min(1, "Fornavn er påkrevd"),
	lastName: z.string().min(1, "Etternavn er påkrevd"),
	email: z
		.email()
		.regex(
			/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)*uio\.no$|^[A-Za-z0-9._%+-]+@ifinavet\.no$/,
			"E-post må være en gyldig uio e-postadresse",
		)
		.trim(),
	password: z.string().min(8, "Passord må være minst 8 tegn"),
	confirmPassword: z.string().min(8, "Bekreft passord må være minst 8 tegn"),
	studyProgram: z.enum(STUDY_PROGRAMS),
	degree: z.enum(DEGREE_TYPES),
	year: z.number().int().min(1).max(5),
});
type SignUpFormSchema = z.infer<typeof signUpFormSchema>;

const verifyingSchema = z.object({
	code: z.string().min(6, "Verifiseringkode må være 6 tegn"),
});

export default function SignUpPage() {
	const { isSignedIn } = useAuth();
	const { isLoaded, signUp, setActive } = useSignUp();
	const postHog = usePostHog();

	const [errors, setErrors] = useState<ClerkAPIError[]>([]);
	const [loading, setLoading] = useState(false);
	const [verifying, setVerifying] = useState(false);

	const router = useRouter();

	const signUpForm = useForm({
		defaultValues: {
			firstName: "",
			lastName: "",
			email: "",
			password: "",
			confirmPassword: "",
			studyProgram: STUDY_PROGRAMS[0] as SignUpFormSchema["studyProgram"],
			degree: DEGREE_TYPES[1] as SignUpFormSchema["degree"],
			year: 1,
		},
		validators: {
			onSubmit: signUpFormSchema,
		},
		onSubmit: async ({ value }) => {
			if (!isLoaded) return;

			try {
				setLoading(true);
				await signUp.create({
					firstName: value.firstName,
					lastName: value.lastName,
					emailAddress: value.email,
					password: value.password,
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
		},
	});

	const createStudent = useMutation(api.students.createByExternalId);
	const verifyingForm = useForm({
		defaultValues: {
			code: "",
		},
		validators: {
			onSubmit: verifyingSchema,
		},
		onSubmit: async ({ value }) => {
			if (!isLoaded) return;

			try {
				setLoading(true);
				const signUpAttempt = await signUp.attemptEmailAddressVerification({
					code: value.code,
				});

				if (signUpAttempt.status === "complete") {
					await setActive({
						session: signUpAttempt.createdSessionId,
					});

					if (signUpAttempt.createdUserId === null) {
						setErrors([
							{
								code: "user_creation_failed",
								longMessage:
									"Bruker kunne ikke opprettes. Vennligst prøv igjen.",
								meta: {},
							} as ClerkAPIError,
						]);
						return;
					}
					const signUpFormValues = signUpForm.state.values;

					await createStudent({
						externalId: signUpAttempt.createdUserId,
						studyProgram: signUpFormValues.studyProgram,
						degree: signUpFormValues.degree,
						year: signUpFormValues.year,
						name: `${signUpFormValues.firstName} ${signUpFormValues.lastName}`,
					});

					postHog.capture("midgard-student-sign-up", {
						email: signUpFormValues.email,
						studyProgram: signUpFormValues.studyProgram,
						degree: signUpFormValues.degree,
						year: signUpFormValues.year,
						name: `${signUpFormValues.firstName} ${signUpFormValues.lastName}`,
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
		},
	});

	if (isSignedIn) {
		router.push("/");
		return null;
	}

	if (verifying) {
		return (
			<ResponsiveCenterContainer className="h-full max-w-3xl!">
				<Title>Opprett ny Bruker</Title>
				<div className="mt-8 grid h-3/5 place-content-center">
					<Card className="m-auto w-80 p-8">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								verifyingForm.handleSubmit();
							}}
							className="w-full space-y-6"
						>
							<FieldGroup className="w-full">
								<verifyingForm.Field name="code">
									{(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid} className="w-full">
												<FieldContent>
													<FieldLabel>Verifiserings kode</FieldLabel>
													<FieldDescription>
														Skriv inn koden du har fått på e-post for å
														verifisere brukeren din.
													</FieldDescription>
												</FieldContent>
												<InputOTP
													maxLength={6}
													id={field.name}
													name={field.name}
													value={field.state.value}
													onChange={(value) => field.handleChange(value)}
													className="w-full"
												>
													<InputOTPGroup className="w-fit">
														<InputOTPSlot index={0} />
														<InputOTPSlot index={1} />
														<InputOTPSlot index={2} />
													</InputOTPGroup>
													<InputOTPSeparator />
													<InputOTPGroup className="w-fit">
														<InputOTPSlot index={3} />
														<InputOTPSlot index={4} />
														<InputOTPSlot index={5} />
													</InputOTPGroup>
												</InputOTP>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								</verifyingForm.Field>
							</FieldGroup>
							<Button type="submit" disabled={loading}>
								Fullfør oppretting
							</Button>
						</form>
					</Card>
				</div>
			</ResponsiveCenterContainer>
		);
	}

	return (
		<ResponsiveCenterContainer className="">
			<Title>Opprett ny Bruker</Title>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					signUpForm.handleSubmit();
				}}
				className="mx-auto max-w-3xl! space-y-8"
			>
				<FieldSet>
					<FieldGroup className="grid gap-4 md:grid-cols-2">
						<signUpForm.Field name="firstName">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Fornavn</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="Ola"
											autoComplete="off"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>

						<signUpForm.Field name="lastName">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Etternavn</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="Nordmann"
											autoComplete="off"
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>
					</FieldGroup>

					<FieldGroup>
						<signUpForm.Field name="email">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Epost</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="eks. olanor@uio.no"
											autoComplete="email"
										/>
										<FieldDescription>
											Oppgi din UIO e-post adresse. Denne må være en gyldig
											(ifi.)uio.no e-post.
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>
					</FieldGroup>

					<FieldGroup className="grid gap-4 md:grid-cols-2">
						<signUpForm.Field name="password">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Passord</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="••••••••"
											autoComplete="email"
										/>
										<FieldDescription>
											Passordet må være minst 8 tegn langt.
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>

						<signUpForm.Field name="confirmPassword">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>
											Bekreft passord
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="••••••••"
											autoComplete="email"
										/>
										<FieldDescription>Bekreft passordet ditt.</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>
					</FieldGroup>

					<FieldGroup>
						<signUpForm.Field name="studyProgram">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Studiegrad</FieldLabel>
										<Select
											onValueChange={(v) =>
												field.handleChange(
													v as SignUpFormSchema["studyProgram"],
												)
											}
											value={field.state.value}
										>
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
										<FieldDescription>
											Oppgi hvilket studieprogram du studerer.
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>
					</FieldGroup>
					<FieldGroup>
						<signUpForm.Field name="degree">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Grad</FieldLabel>
										<Select
											onValueChange={(v) =>
												field.handleChange(v as SignUpFormSchema["degree"])
											}
											value={field.state.value}
										>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Velg en grad" />
											</SelectTrigger>
											<SelectContent>
												{DEGREE_TYPES.map((degree) => (
													<SelectItem key={degree} value={degree}>
														{degree}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldDescription>
											Oppgi hvilken grad du studerer (f.eks. Bachelor, Master,
											etc.).
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>
					</FieldGroup>

					<FieldGroup>
						<signUpForm.Field name="year">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>År</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(Number.parseInt(e.target.value))
											}
											type="number"
											min={1}
											max={5}
											autoComplete="off"
										/>
										<FieldDescription>
											Oppgi hvilket år du er på. (4. året er 1. året på master)
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</signUpForm.Field>
					</FieldGroup>
				</FieldSet>

				<div id="clerk-captcha"></div>

				{errors && errors.length > 0 && (
					<ul className="list-disc space-y-1 pl-5 text-destructive text-sm">
						{errors.map((error) => (
							<li key={error.code}>{error.longMessage}</li>
						))}
					</ul>
				)}

				<small className="block font-medium text-sm leading-none">
					Når du registrerer en bruker på ifinavet.no så godtar du IFI-Navets{" "}
					<a
						href="/info/personvernerklaering"
						className="text-primary underline dark:text-primary-foreground"
					>
						personvernerklæring.
					</a>
				</small>

				<Button
					type="submit"
					className="text-primary-foreground"
					disabled={loading}
				>
					Opprett ny bruker
				</Button>
			</form>
		</ResponsiveCenterContainer>
	);
}
