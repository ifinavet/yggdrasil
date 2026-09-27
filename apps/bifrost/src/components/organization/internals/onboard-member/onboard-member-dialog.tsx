"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import { onboardingSchema, suggestWorkspaceEmail } from "@workspace/shared/iam";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useId, useMemo } from "react";
import { toast } from "sonner";
import PositionGroupField from "@/components/common/forms/position-group-field";
import type { OnboardingPrefill } from "../access/access-status";
import { type UioUser, UioUserSearch } from "../uio-user-search";

const EMPTY: OnboardingPrefill = { firstName: "", lastName: "", uioEmail: "", workspaceEmail: "" };

type TextFieldApi = {
	name: string;
	state: {
		value: string;
		meta: { isTouched: boolean; isValid: boolean; errors: Array<{ message?: string } | undefined> };
	};
	handleChange: (value: string) => void;
	handleBlur: () => void;
};

function TextField({
	field,
	label,
	type = "text",
	placeholder,
	autoComplete,
	onValueChange,
}: Readonly<{
	field: TextFieldApi;
	label: string;
	type?: "text" | "email";
	placeholder?: string;
	autoComplete?: string;
	onValueChange?: (value: string) => void;
}>) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<Input
				id={field.name}
				name={field.name}
				type={type}
				value={field.state.value}
				placeholder={placeholder}
				autoComplete={autoComplete}
				spellCheck={false}
				aria-invalid={isInvalid}
				onBlur={field.handleBlur}
				onChange={(event) => {
					field.handleChange(event.target.value);
					onValueChange?.(event.target.value);
				}}
			/>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}

export function OnboardMemberDialog({
	open,
	onOpenChange,
	prefill,
	domain,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prefill: OnboardingPrefill | null;
	domain: string | null;
}>) {
	const uioLabelId = useId();
	const startOnboarding = useMutation(api.iam.mutations.startOnboarding);
	const schema = useMemo(() => onboardingSchema(domain), [domain]);

	const form = useForm({
		defaultValues: { ...EMPTY, group: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			try {
				const { activated } = await startOnboarding(schema.parse(value));
				toast.success(`${value.firstName.trim()} er lagt til`, {
					description: activated
						? "Personen hadde allerede bruker i Bifrost og er intern nå."
						: `Innlogging og Slack-invitasjon sendes til ${value.uioEmail.trim()}.`,
				});
				onOpenChange(false);
			} catch (error) {
				toast.error("Kunne ikke legge til personen", {
					description: error instanceof ConvexError ? String(error.data) : "Prøv igjen om litt.",
				});
			}
		},
	});

	useEffect(() => {
		if (open) form.reset({ ...EMPTY, ...prefill, group: "" });
	}, [open, prefill, form]);

	const suggestWorkspace = () => {
		if (!domain || prefill?.workspaceEmail || form.getFieldMeta("workspaceEmail")?.isDirty) return;
		const { firstName, lastName } = form.state.values;
		form.setFieldValue("workspaceEmail", suggestWorkspaceEmail(firstName, lastName, domain), {
			dontUpdateMeta: true,
		});
	};

	const pickUioUser = (user: UioUser) => {
		form.setFieldValue("uioEmail", user.email);
		if (user.firstName && !form.state.values.firstName.trim())
			form.setFieldValue("firstName", user.firstName);
		if (user.lastName && !form.state.values.lastName.trim())
			form.setFieldValue("lastName", user.lastName);
		suggestWorkspace();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Legg til medlem</DialogTitle>
					<DialogDescription>
						Bifrost lager Google-kontoen og sender innlogging og Slack-invitasjon til UiO-adressen.
						Personen blir intern første gang de logger inn.
					</DialogDescription>
				</DialogHeader>
				<form
					id="onboard-member"
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<FieldGroup className="gap-5">
						<div className="grid gap-5 sm:grid-cols-2">
							<form.Field name="firstName">
								{(field) => (
									<TextField
										field={field}
										label="Fornavn"
										autoComplete="off"
										onValueChange={suggestWorkspace}
									/>
								)}
							</form.Field>
							<form.Field name="lastName">
								{(field) => (
									<TextField
										field={field}
										label="Etternavn"
										autoComplete="off"
										onValueChange={suggestWorkspace}
									/>
								)}
							</form.Field>
						</div>
						<form.Field name="uioEmail">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel id={uioLabelId}>UiO-e-post</FieldLabel>
										<UioUserSearch
											aria-labelledby={uioLabelId}
											aria-invalid={isInvalid}
											value={field.state.value}
											onChange={pickUioUser}
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="workspaceEmail">
							{(field) => (
								<TextField
									field={field}
									label="Navet-e-post"
									type="email"
									placeholder={domain ? `fornavn.etternavn@${domain}` : undefined}
									autoComplete="off"
								/>
							)}
						</form.Field>
						<form.Field name="group">{(field) => <PositionGroupField field={field} />}</form.Field>
					</FieldGroup>
				</form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Avbryt</Button>
					</DialogClose>
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" form="onboard-member" disabled={isSubmitting}>
								{isSubmitting ? "Legger til..." : "Legg til"}
							</Button>
						)}
					</form.Subscribe>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
