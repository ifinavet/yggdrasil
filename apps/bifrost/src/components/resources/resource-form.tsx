"use client";

import { useForm } from "@tanstack/react-form";
import { EditorContent } from "@tiptap/react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { EyeOff, Save, Send } from "lucide-react";
import { useCallback } from "react";
import FormSubmitActions from "@/components/common/forms/form-submit-actions";
import { EditorMenu } from "@/components/common/forms/markdown-editor/markdown-editor";
import { useContentEditor } from "@/components/common/forms/markdown-editor/use-content-editor";
import { cardIcons } from "@/constants/resource-constants";
import { type ResourceFormValues, resourceSchema } from "@/constants/schemas/resource-form-schema";

type FormMeta = {
	submitAction: "primary" | "secondary" | "tertiary";
};

export default function ResourceForm({
	defaultValues,
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
}: Readonly<{
	defaultValues: ResourceFormValues;
	onPrimarySubmitAction: (values: ResourceFormValues) => void;
	onSecondarySubmitAction: (values: ResourceFormValues) => void;
	onTertiarySubmitAction?: (values: ResourceFormValues) => void;
}>) {
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: resourceSchema,
		},
		onSubmitMeta: {
			submitAction: "primary",
		} as FormMeta,
		onSubmit: async ({ value, meta }) => {
			switch (meta.submitAction) {
				case "primary":
					onPrimarySubmitAction(value);
					break;
				case "secondary":
					onSecondarySubmitAction(value);
					break;
				case "tertiary":
					onTertiarySubmitAction?.(value);
					break;
				default:
					break;
			}
		},
	});

	const setContent = useCallback((html: string) => form.setFieldValue("content", html), [form]);

	const editor = useContentEditor({
		placeholder: "Skriv en helt fantaskisk ressurs som alle i Navet kan ha glede av å lese!",
		initialContent: form.state.values.content,
		onContentChange: setContent,
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldSet>
				<FieldGroup className="flex flex-col gap-4 md:flex-row">
					<form.Field name="title">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid} className="min-w-0 md:w-full">
									<FieldLabel htmlFor={field.name}>Tittel</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="Tittel"
										className="truncate"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>
										En kort informativ tittel som beskriver ressursen.
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="tag">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid} className="min-w-0 md:w-full">
									<FieldLabel htmlFor={field.name}>Tag</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										placeholder="f.eks how-to-bedpress"
										className="truncate"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>
										En tag for å grupere ressurser med samme tema eller fokus
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="icon">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid} className="min-w-0 md:w-full">
									<FieldLabel htmlFor={field.name}>Icon</FieldLabel>
									<div className="flex items-center gap-2">
										<Select onValueChange={field.handleChange} value={field.state.value}>
											<SelectTrigger className="w-40">
												<SelectValue placeholder="Velg ikon" />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(cardIcons).map(([key, Icon]) => (
													<SelectItem key={key} value={key}>
														<Icon className="h-4 w-4" />
														<span className="capitalize">{key}</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>Velg et icon.</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="excerpt">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Sammendrag</FieldLabel>
									<FieldDescription>Et kort beskrivende sammendrag av ressursen</FieldDescription>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
										placeholder="Et kort beskrivende sammendrag av ressursen"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>En kort beskrivelse/sammendrag av ressursen</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
					<FieldSeparator />
					<form.Field name="content">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Innhold</FieldLabel>
									<FieldDescription>Innholdet til ressursen</FieldDescription>
									<div className="min-h-[50vh] overflow-clip rounded-md border">
										<EditorMenu editor={editor} />
										<EditorContent editor={editor} />
									</div>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>Innholdet til ressursen</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FormSubmitActions
					className="flex-row gap-2"
					isSubmitting={form.state.isSubmitting}
					onSubmitAction={(submitAction) => form.handleSubmit({ submitAction })}
					primary={{ label: "Lagre og publiser", icon: <Send /> }}
					secondary={{ label: "Lagre", icon: <Save /> }}
					tertiary={onTertiarySubmitAction && { label: "Lagre og avpubliser", icon: <EyeOff /> }}
				/>
			</FieldSet>
		</form>
	);
}
