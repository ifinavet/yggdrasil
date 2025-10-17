"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import z from "zod/v4";
import { authClient } from "@/lib/auth/auth-client";

const schema = z.object({
	email: z.email("Vennligst oppgi en gyldig e-postadresse"),
	password: z
		.string()
		.min(8, "Vennligst oppgi et passord som er minst 8 tegn langt"),
});

const translations = {
	email: "E-postadresse",
	password: "Passord",
};

export default function SignIn() {
	const [error, setError] = useState<string | null>(null);

	const signUpForm = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onBlur: schema,
			onSubmit: schema,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.signIn.email({
				email: value.email,
				password: value.password,
			});

			if (error) {
				setError(`Feil! - ${error.message}`);
			}

			const organizations = await authClient.organization.list();

			if (organizations.error) {
				throw new Error("Failed to fetch organizations");
			}

			if (organizations.data.length >= 1 && organizations.data[0]) {
				await authClient.organization.setActive({
					organizationId: organizations.data[0].id,
					organizationSlug: organizations.data[0].slug,
				});
			}

			router.push("/");
		},
	});

	// Redirect to home page if user is already logged in
	const { data } = authClient.useSession();
	const router = useRouter();
	if (data) router.push("/");

	return (
		<div className="w-full">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					signUpForm.handleSubmit();
				}}
			>
				<FieldGroup>
					<FieldSet>
						<FieldLegend>Logg inn</FieldLegend>
						<FieldGroup>
							<signUpForm.Field name="email">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												{translations[field.name]}
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="off"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							</signUpForm.Field>
							<signUpForm.Field name="password">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												{translations[field.name]}
											</FieldLabel>
											<Input
												type="password"
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
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
					</FieldSet>
					<FieldSeparator />
					<FieldSet>
						<Link href="/sign-up">sign up</Link>
					</FieldSet>

					<Field>
						<Button type="submit">sign in</Button>
						{error && <FieldError>{error}</FieldError>}
					</Field>
				</FieldGroup>
			</form>
		</div>
	);
}
