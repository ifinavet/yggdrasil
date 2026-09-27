"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { LOGO_ACCEPT, LOGO_CONTENT_TYPES } from "@workspace/shared/logo";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel, FieldSet } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { logoUploadErrorMessage, uploadLogo } from "@workspace/ui/lib/logo-upload";
import { useMutation } from "convex/react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import z from "zod/v4";

const schema = z.object({
	image: z
		.instanceof(File)
		.refine(
			(file) => (LOGO_CONTENT_TYPES as readonly string[]).includes(file.type),
			"Bildet må være av type JPEG, SVG, WebP eller PNG",
		),
	name: z.string().min(1, "Navn er påkrevd"),
});

type ImageUploadFormValues = {
	image: File | undefined;
	name: string;
};

export default function CompanyImageUploader({
	onImageUploadedAction,
	onDismissAction,
}: Readonly<{
	onImageUploadedAction: (imageId: Id<"companyLogos">, imageName: string) => void;
	onDismissAction: () => void;
}>) {
	const generateUploadUrl = useMutation(api.companies.mutations.generateUploadUrl);
	const storeCompanyImage = useMutation(api.companies.mutations.uploadCompanyLogo);

	const form = useForm({
		defaultValues: {
			image: undefined,
			name: "",
		} as ImageUploadFormValues,
		validators: {
			onSubmit: schema,
		},
		onSubmit: async ({ value }) => {
			console.log("Upload image called with:", value);

			if (!value.image) {
				toast.error("Vennligst velg et bilde");
				return;
			}

			try {
				const { storageId } = await uploadLogo(value.image, generateUploadUrl);

				const logoId = await storeCompanyImage({
					id: storageId as Id<"_storage">,
					name: value.name,
				});

				form.reset();
				toast.success("Bilde lastet opp og lagret!");

				if (onImageUploadedAction && logoId) {
					onImageUploadedAction(logoId, value.name);
				}
			} catch (error) {
				console.error("Error uploading image:", error);
				toast.error(
					logoUploadErrorMessage(
						error,
						"Noe gikk galt under opplastingen av bildet. Vennligst prøv igjen.",
					),
				);
			}
		},
	});

	return (
		<form
			className="space-y-8"
			onSubmit={(e) => {
				console.log("Form submit intercepted");
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldSet>
				<form.Field name="image">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Velg bilde som skal lastes opp.</FieldLabel>
								<Input
									id={field.name}
									type="file"
									accept={LOGO_ACCEPT}
									name={field.name}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
									onChange={(event) => {
										const file = event.target.files?.[0];
										field.handleChange(file);
									}}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="name">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field>
								<FieldLabel htmlFor={field.name}>Navn på bildet</FieldLabel>
								<Input
									id={field.name}
									type="text"
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={isInvalid}
									placeholder="Skriv inn navnet på selskapet"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldSet>

			<div className="flex gap-4">
				<Button type="submit" disabled={form.state.isSubmitting}>
					<Send />
					{form.state.isSubmitting ? "Laster opp..." : "Last opp"}
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={onDismissAction}
					disabled={form.state.isSubmitting}
				>
					<X />
					Avbryt
				</Button>
			</div>
		</form>
	);
}
