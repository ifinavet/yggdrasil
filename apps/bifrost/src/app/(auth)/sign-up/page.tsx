"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import z from "zod/v4";
import { authClient } from "@/lib/auth/auth-client";

const schema = z.object({
	firstname: z.string().min(2).max(100),
	lastname: z.string().min(2).max(100),
	email: z.string().email(),
	password: z.string().min(8).max(100),
});

export default function SignUp() {
	const signUpForm = useForm({
		defaultValues: {
			firstname: "",
			lastname: "",
			email: "",
			password: "",
		},
		validators: {
			onChange: schema,
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email({
				email: value.email,
				password: value.password,
				name: `${value.firstname} ${value.lastname}`,
			});
		},
	});

	return (
		<div className="w-full">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					signUpForm.handleSubmit();
				}}
			>
				<FieldGroup>
					<signUpForm.Field name="firstname">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>{field.name}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="off"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</signUpForm.Field>
					<signUpForm.Field name="lastname">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>{field.name}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="off"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</signUpForm.Field>
					<signUpForm.Field name="email">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>{field.name}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="off"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
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
									<FieldLabel htmlFor={field.name}>{field.name}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										autoComplete="off"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</signUpForm.Field>
				</FieldGroup>
				<Button type="submit">signUp</Button>
			</form>
		</div>
	);
}
