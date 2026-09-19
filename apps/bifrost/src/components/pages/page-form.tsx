"use client";

import { useForm } from "@tanstack/react-form";
import { EditorContent } from "@tiptap/react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { EyeOff, Save, Send } from "lucide-react";
import { useCallback } from "react";
import FormSubmitActions from "@/components/common/forms/form-submit-actions";
import { EditorMenu } from "@/components/common/forms/markdown-editor/markdown-editor";
import { useContentEditor } from "@/components/common/forms/markdown-editor/use-content-editor";
import { type PageFormValues, pageSchema } from "@/constants/schemas/page-form-schema";

type FormMeta = {
	submitAction: "primary" | "secondary" | "tertiary";
};

export default function PageForm({
	defaultValues,
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
}: Readonly<{
	defaultValues: PageFormValues;
	onPrimarySubmitAction: (values: PageFormValues) => void;
	onSecondarySubmitAction: (values: PageFormValues) => void;
	onTertiarySubmitAction?: (values: PageFormValues) => void;
}>) {
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: pageSchema,
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
		placeholder: "Lag en bra side, foreksempel en personvernerklæring",
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
			className="space-y-2"
		>
			<FieldSet>
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
								<FieldDescription>En kort informativ tittel som beskriver siden.</FieldDescription>
							</Field>
						);
					}}
				</form.Field>

				<Separator className="my-4" />

				<form.Field name="content">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid} className="min-w-0 md:w-full">
								<FieldLabel htmlFor={field.name}>Innhold</FieldLabel>
								<div className="min-h-[60vh] overflow-clip rounded-md border">
									<EditorMenu editor={editor} />
									<EditorContent editor={editor} />
								</div>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								<FieldDescription>Innholdet på siden.</FieldDescription>
							</Field>
						);
					}}
				</form.Field>
			</FieldSet>

			<FormSubmitActions
				className="flex-wrap"
				isSubmitting={form.state.isSubmitting}
				onSubmitAction={(submitAction) => form.handleSubmit({ submitAction })}
				primary={{ label: "Lagre og publiser", icon: <Send /> }}
				secondary={{ label: "Lagre", icon: <Save /> }}
				tertiary={onTertiarySubmitAction && { label: "Lagre og avpubliser", icon: <EyeOff /> }}
			/>
		</form>
	);
}
