"use client";
import type { AnyFieldApi } from "@tanstack/react-form";
import {
	type ClerkAPIError,
	isClerkAPIResponseError,
	LocalAuthNotice,
	type SignUpResource,
	useAuth,
	useSignUp,
} from "@workspace/auth/client";
import { useConvexAuth } from "@workspace/auth/convex";
import { isLocalDevelopment } from "@workspace/auth/local";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, refineStudentProfile, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
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
import { Spinner } from "@workspace/ui/components/spinner";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import {
	STUDY_FIELDS,
	StudyFields,
	type StudyValues,
	studySchema,
} from "@/components/profile/study-fields";
import { useAppForm } from "@/lib/form";
import { redirectFromSearch } from "@/utils/auth-redirect";

function postSignUpPath() {
	return typeof window === "undefined" ? "/" : redirectFromSearch(window.location.search);
}

const accountSchema = z.object({
	email: z
		.email()
		.regex(
			/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)*uio\.no$|^[A-Za-z0-9._%+-]+@ifinavet\.no$/,
			"E-post må være en gyldig uio e-postadresse",
		)
		.trim(),
	firstName: z.string().min(1, "Fornavn er påkrevd").trim(),
	lastName: z.string().min(1, "Etternavn er påkrevd").trim(),
});

const passwordSchema = z
	.object({
		password: z.string().min(8, "Passord må være minst 8 tegn"),
		confirmPassword: z.string().min(8, "Bekreft passord må være minst 8 tegn"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passordene må være like",
	});

const verifyingSchema = z.object({
	code: z.string().min(6, "Verifiseringkode må være 6 tegn"),
});

const STEPS = ["account", "password", "study", "code"] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
	account: "Opprett bruker",
	password: "Velg passord",
	study: "Hva studerer du?",
	code: "Bekreft e-posten din",
};

type PendingStudent = StudyValues & {
	externalId: string;
	name: string;
};

type PendingSignUp = {
	student: PendingStudent;
	email: string;
};

const AUTHENTICATION_TIMEOUT_MS = 15 * 1000;

function errorsFrom(error: unknown): ClerkAPIError[] {
	if (isClerkAPIResponseError(error)) return error.errors;
	return [
		{
			code: "unknown_error",
			longMessage: "Noe gikk galt. Vennligst prøv igjen.",
			meta: {},
		} as ClerkAPIError,
	];
}

// Clerk names the parameter an error belongs to; those errors are shown under the matching field.
const CLERK_FIELDS: Record<string, string> = {
	email_address: "email",
	first_name: "firstName",
	last_name: "lastName",
	password: "password",
	code: "code",
};

function fieldOf(error: ClerkAPIError): string | undefined {
	return CLERK_FIELDS[error.meta?.paramName ?? ""];
}

type ServerErrors = { errors: { message: string }[]; clear: () => void };

export default function SignUpPage() {
	if (isLocalDevelopment) {
		return <LocalAuthNotice />;
	}
	return <ClerkSignUpPage />;
}

function ClerkSignUpPage() {
	const { isSignedIn } = useAuth();
	const { isLoaded, signUp, setActive } = useSignUp();
	const { isAuthenticated } = useConvexAuth();
	const postHog = usePostHog();

	const [step, setStep] = useState<Step>("account");
	const [errors, setErrors] = useState<ClerkAPIError[]>([]);
	const [loading, setLoading] = useState(false);
	const [pendingSignUp, setPendingSignUp] = useState<PendingSignUp | null>(null);
	const [signUpCompletionFailed, setSignUpCompletionFailed] = useState(false);
	const signUpRequest = useRef<Promise<SignUpResource> | null>(null);
	const uniqueErrors = errors.filter(
		(error, index, all) => all.findIndex((candidate) => candidate.code === error.code) === index,
	);
	const formErrors = uniqueErrors.filter((error) => !fieldOf(error));
	const serverErrors = (name: string): ServerErrors => {
		const own = uniqueErrors.filter((error) => fieldOf(error) === name);
		return {
			// A weak password comes with Clerk's suggestions for a stronger one.
			errors: own.flatMap((error) => [
				{ message: error.longMessage ?? error.message },
				...(error.meta?.zxcvbn?.suggestions ?? []),
			]),
			clear: () => {
				if (own.length > 0) setErrors((all) => all.filter((error) => fieldOf(error) !== name));
			},
		};
	};

	const router = useRouter();

	const goTo = (next: Step) => {
		setErrors([]);
		setStep(next);
	};

	// Sends each step to Clerk as soon as it is filled in, so a taken e-mail or a weak password
	// is reported on the step it belongs to.
	const submitStep = async (send: () => Promise<unknown>, next: Step): Promise<boolean> => {
		try {
			setLoading(true);
			await send();
			goTo(next);
			return true;
		} catch (error) {
			setErrors(errorsFrom(error));
			return false;
		} finally {
			setLoading(false);
		}
	};

	const accountForm = useAppForm({
		defaultValues: { email: "", firstName: "", lastName: "" },
		validators: { onSubmit: accountSchema },
		// Clerk's bot check makes creating the sign-up slow, so the visitor moves on to the password
		// while it runs, and is sent back here if the e-mail is rejected.
		onSubmit: ({ value }) => {
			if (!isLoaded) return;
			const request = signUp.create({
				emailAddress: value.email,
				firstName: value.firstName.trimEnd(),
				lastName: value.lastName.trimEnd(),
			});
			signUpRequest.current = request;
			goTo("password");
			request.catch((error) => {
				if (signUpRequest.current !== request) return;
				setErrors(errorsFrom(error));
				setStep("account");
			});
		},
	});

	const passwordForm = useAppForm({
		defaultValues: { password: "", confirmPassword: "" },
		validators: { onSubmit: passwordSchema },
		onSubmit: async ({ value }) => {
			const request = signUpRequest.current;
			if (!request) return;
			await submitStep(async () => (await request).update({ password: value.password }), "study");
		},
	});

	const studyForm = useAppForm({
		defaultValues: {
			studyProgram: STUDY_PROGRAMS[0],
			degree: DEGREE_TYPES[1],
			year: 1,
		} as StudyValues,
		validators: { onSubmit: studySchema.superRefine(refineStudentProfile) },
		onSubmit: async () => {
			if (!isLoaded) return;
			await submitStep(
				() => signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
				"code",
			);
		},
	});

	const createStudent = useMutation(api.users.students.mutations.createByExternalId);
	const isCreatingStudent = useRef(false);

	useEffect(() => {
		if (!isAuthenticated || !pendingSignUp || signUpCompletionFailed || isCreatingStudent.current)
			return;

		isCreatingStudent.current = true;

		const createStudentProfile = async () => {
			try {
				await createStudent(pendingSignUp.student);
				setErrors([]);
				setPendingSignUp(null);

				postHog.capture("midgard-student-sign-up", {
					email: pendingSignUp.email,
					studyProgram: pendingSignUp.student.studyProgram,
					degree: pendingSignUp.student.degree,
					year: pendingSignUp.student.year,
					name: pendingSignUp.student.name,
				});

				router.push(postSignUpPath());
			} catch (error) {
				setErrors([
					{
						code: "student_creation_failed",
						longMessage:
							error instanceof ConvexError && typeof error.data === "string"
								? error.data
								: "Studentprofilen kunne ikke opprettes. Vennligst prøv igjen.",
						meta: {},
					} as ClerkAPIError,
				]);
				setSignUpCompletionFailed(true);
				setLoading(false);
			} finally {
				isCreatingStudent.current = false;
			}
		};

		void createStudentProfile();
	}, [isAuthenticated, pendingSignUp, signUpCompletionFailed, createStudent, postHog, router]);

	const retryProfileCreation = () => {
		setErrors([]);
		setSignUpCompletionFailed(false);
		setLoading(true);
	};

	const resendCode = async () => {
		if (!isLoaded) return;
		const sent = await submitStep(
			() => signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
			"code",
		);
		if (sent) toast.success("Vi har sendt en ny kode.");
	};

	useEffect(() => {
		if (!pendingSignUp || isAuthenticated) return;

		const timeoutId = setTimeout(() => {
			setErrors([
				{
					code: "authentication_is_slow",
					longMessage:
						"Innloggingen tar lengre tid enn vanlig. Vent litt, eller last siden på nytt.",
					meta: {},
				} as ClerkAPIError,
			]);
		}, AUTHENTICATION_TIMEOUT_MS);

		return () => clearTimeout(timeoutId);
	}, [pendingSignUp, isAuthenticated]);

	const verifyingForm = useAppForm({
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

				if (signUpAttempt.status !== "complete") {
					setErrors([
						{
							code: "verification_failed",
							longMessage: "Verifisering mislyktes. Vennligst prøv igjen.",
							meta: {},
						} as ClerkAPIError,
					]);
					console.error("Verification failed", signUpAttempt);
					setLoading(false);
					return;
				}

				if (signUpAttempt.createdUserId === null) {
					setErrors([
						{
							code: "user_creation_failed",
							longMessage: "Bruker kunne ikke opprettes. Vennligst prøv igjen.",
							meta: {},
						} as ClerkAPIError,
					]);
					setLoading(false);
					return;
				}

				const account = accountForm.state.values;

				// Store the profile before activating the session. Once signed in, the page redirects
				// away unless a sign-up is pending, and the student profile would never be created.
				setPendingSignUp({
					email: account.email,
					student: {
						...studyForm.state.values,
						externalId: signUpAttempt.createdUserId,
						name: `${account.firstName} ${account.lastName}`,
					},
				});

				await setActive({
					session: signUpAttempt.createdSessionId,
				});
			} catch (error) {
				setErrors(errorsFrom(error));
				setPendingSignUp(null);
				setLoading(false);
			}
		},
	});

	const signedInElsewhere = isSignedIn && !pendingSignUp && !signUpCompletionFailed;

	// Redirect from an effect, not while rendering: Next.js keeps this page rendered while hidden
	// after navigating away, and effects only run while the page is visible.
	useEffect(() => {
		if (signedInElsewhere) router.push(postSignUpPath());
	}, [signedInElsewhere, router]);

	if (signedInElsewhere) return null;

	// Next.js keeps this page's state after navigating away, so closing starts the sign-up over
	// instead of reopening on the step the visitor left.
	const close = () => {
		signUpRequest.current = null;
		goTo("account");
		passwordForm.reset();
		verifyingForm.reset();
		router.push(postSignUpPath());
	};

	return (
		<Dialog open onOpenChange={(open) => !open && close()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{STEP_TITLES[step]}</DialogTitle>
					<DialogDescription>
						Steg {STEPS.indexOf(step) + 1} av {STEPS.length}
					</DialogDescription>
				</DialogHeader>

				{step === "account" && (
					<StepForm onSubmit={accountForm.handleSubmit} loading={loading}>
						<accountForm.Field name="email">
							{(field) => (
								<TextField
									field={field}
									serverErrors={serverErrors(field.name)}
									label="E-post"
									description="Bruk UiO-adressen din, for eksempel olanor@uio.no."
									placeholder="olanor@uio.no"
									autoComplete="email"
									autoFocus
								/>
							)}
						</accountForm.Field>
						<FieldGroup className="grid gap-4 sm:grid-cols-2">
							<accountForm.Field name="firstName">
								{(field) => (
									<TextField
										field={field}
										serverErrors={serverErrors(field.name)}
										label="Fornavn"
										placeholder="Ola"
										autoComplete="given-name"
									/>
								)}
							</accountForm.Field>
							<accountForm.Field name="lastName">
								{(field) => (
									<TextField
										field={field}
										serverErrors={serverErrors(field.name)}
										label="Etternavn"
										placeholder="Nordmann"
										autoComplete="family-name"
									/>
								)}
							</accountForm.Field>
						</FieldGroup>
						<small className="block text-muted-foreground text-sm">
							Når du registrerer en bruker på ifinavet.no så godtar du IFI-Navets{" "}
							<a
								href="/info/personvernerklaering"
								className="text-primary underline dark:text-primary-foreground"
							>
								personvernerklæring.
							</a>
						</small>
					</StepForm>
				)}

				{step === "password" && (
					<StepForm
						onSubmit={passwordForm.handleSubmit}
						onBack={() => goTo("account")}
						loading={loading}
					>
						<passwordForm.Field name="password">
							{(field) => (
								<TextField
									field={field}
									serverErrors={serverErrors(field.name)}
									label="Passord"
									description="Passordet må være minst 8 tegn langt."
									type="password"
									placeholder="••••••••"
									autoComplete="new-password"
									autoFocus
								/>
							)}
						</passwordForm.Field>
						<passwordForm.Field name="confirmPassword">
							{(field) => (
								<TextField
									field={field}
									serverErrors={serverErrors(field.name)}
									label="Bekreft passord"
									type="password"
									placeholder="••••••••"
									autoComplete="new-password"
								/>
							)}
						</passwordForm.Field>
					</StepForm>
				)}

				{step === "study" && (
					<StepForm
						onSubmit={studyForm.handleSubmit}
						onBack={() => goTo("password")}
						loading={loading}
						submitLabel="Opprett bruker"
					>
						<StudyFields form={studyForm} fields={STUDY_FIELDS} />
					</StepForm>
				)}

				{step === "code" && (
					<StepForm
						onSubmit={verifyingForm.handleSubmit}
						onBack={
							pendingSignUp
								? undefined
								: () => {
										verifyingForm.reset();
										goTo("study");
									}
						}
						loading={loading}
						submitLabel="Fullfør oppretting"
					>
						<verifyingForm.Field name="code">
							{(field) => {
								const server = serverErrors(field.name);
								const errors = fieldErrors(field, server);
								return (
									<Field data-invalid={errors.length > 0}>
										<FieldContent>
											<FieldLabel htmlFor={field.name}>Verifiseringskode</FieldLabel>
											<FieldDescription>
												Vi har sendt en kode til {accountForm.state.values.email}. Sjekk også
												søppelposten.
											</FieldDescription>
										</FieldContent>
										<InputOTP
											maxLength={6}
											id={field.name}
											name={field.name}
											value={field.state.value}
											onChange={(value) => {
												field.handleChange(value);
												server.clear();
											}}
											autoFocus
										>
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
										{errors.length > 0 && <FieldError errors={errors} />}
									</Field>
								);
							}}
						</verifyingForm.Field>
						{!pendingSignUp && (
							<Button
								type="button"
								variant="link"
								className="h-auto justify-start p-0"
								onClick={resendCode}
								disabled={loading}
							>
								Fikk du ingen kode? Send den på nytt
							</Button>
						)}
						{signUpCompletionFailed && (
							<Button type="button" variant="outline" onClick={retryProfileCreation}>
								Prøv å opprette studentprofilen på nytt
							</Button>
						)}
					</StepForm>
				)}

				<div id="clerk-captcha"></div>

				{formErrors.length > 0 && (
					<ul className="list-disc space-y-1 pl-5 text-destructive text-sm">
						{formErrors.map((error) => (
							<li key={error.code}>{error.longMessage}</li>
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
}

function StepForm({
	onSubmit,
	onBack,
	loading,
	submitLabel = "Neste",
	children,
}: Readonly<{
	onSubmit: () => void;
	onBack?: () => void;
	loading: boolean;
	submitLabel?: string;
	children: ReactNode;
}>) {
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit();
			}}
			className="space-y-6"
		>
			<FieldSet>{children}</FieldSet>
			<DialogFooter>
				{onBack && (
					<Button type="button" variant="outline" onClick={onBack} disabled={loading}>
						Tilbake
					</Button>
				)}
				<Button type="submit" className="text-primary-foreground" disabled={loading}>
					{loading && <Spinner />}
					{submitLabel}
				</Button>
			</DialogFooter>
		</form>
	);
}

function TextField({
	field,
	serverErrors,
	label,
	description,
	...props
}: Readonly<
	{
		field: AnyFieldApi;
		serverErrors: ServerErrors;
		label: string;
		description?: string;
	} & ComponentProps<typeof Input>
>) {
	const errors = fieldErrors(field, serverErrors);
	return (
		<Field data-invalid={errors.length > 0}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<Input
				id={field.name}
				name={field.name}
				value={field.state.value}
				onBlur={field.handleBlur}
				onChange={(e) => {
					field.handleChange(e.target.value);
					serverErrors.clear();
				}}
				aria-invalid={errors.length > 0}
				{...props}
			/>
			{description && <FieldDescription>{description}</FieldDescription>}
			{errors.length > 0 && <FieldError errors={errors} />}
		</Field>
	);
}

/** The form's own validation errors for a field, followed by the errors Clerk returned for it. */
function fieldErrors(field: AnyFieldApi, serverErrors: ServerErrors) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
	return [...(isInvalid ? field.state.meta.errors : []), ...serverErrors.errors];
}
