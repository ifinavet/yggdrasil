"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { uioEmailSchema } from "@workspace/shared/iam";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError } from "@workspace/ui/components/field";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useId } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { UioUserSearch } from "./uio-user-search";

const schema = z.object({ uioEmail: uioEmailSchema });

export function AddUioEmail({ internalId }: Readonly<{ internalId: Id<"internals"> }>) {
	const labelId = useId();
	const addUioEmail = useMutation(api.iam.mutations.addUioEmail);
	const form = useForm({
		defaultValues: { uioEmail: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			try {
				await addUioEmail({ internalId, uioEmail: value.uioEmail });
			} catch (error) {
				toast.error("Kunne ikke legge til UiO-adressen", {
					description: error instanceof ConvexError ? String(error.data) : "Prøv igjen om litt.",
				});
			}
		},
	});

	return (
		<form
			noValidate
			className="flex flex-wrap items-start gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="uioEmail">
				{(field) => {
					const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid} className="w-72 max-w-full">
							<span id={labelId} className="sr-only">
								UiO-adresse
							</span>
							<UioUserSearch
								aria-labelledby={labelId}
								aria-invalid={isInvalid}
								value={field.state.value}
								onChange={(user) => field.handleChange(user.email)}
							/>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</form.Field>
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button type="submit" variant="outline" disabled={isSubmitting}>
						Legg til UiO-adresse
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
