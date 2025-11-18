"use client";

import { useForm } from "@tanstack/react-form";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@workspace/ui/components/button";
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
import React, { useCallback, useMemo } from "react";
import { EditorMenu } from "@/components/common/forms/markdown-editor/markdown-editor";
import { cardIcons } from "@/constants/resource-constants";
import {
	type ResourceFormValues,
	resourceSchema,
} from "@/constants/schemas/resource-form-schema";

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

	const handleEditorUpdate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setFieldValue("content", editor.getHTML());
		},
		[form],
	);

	const handleEditorCreate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setFieldValue("content", editor.getHTML());
		},
		[form],
	);

	const editorExtensions = useMemo(
		() => [
			StarterKit,
			Placeholder.configure({
				emptyEditorClass:
					"before:content-[attr(data-placeholder)] before:float-left before:text-muted-foreground before:h-0 before:pointer-events-none",
				placeholder:
					"Skriv en helt fantaskisk ressurs som alle i Navet kan ha glede av å lese!",
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				defaultProtocol: "https",
				protocols: ["https", "mailto", "tel"],
				autolink: true,
			}),
		],
		[],
	);

	const editorProps = useMemo(
		() => ({
			attributes: {
				class:
					"prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert",
			},
		}),
		[],
	);

	const editor = useEditor({
		extensions: editorExtensions,
		editorProps: editorProps,
		onUpdate: handleEditorUpdate,
		immediatelyRender: false,
		content: form.state.values.content,
		onCreate: handleEditorCreate,
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid} className="min-w-0 md:w-full">
									<FieldLabel htmlFor={field.name}>Icon</FieldLabel>
									<div className="flex items-center gap-2">
										<Select
											onValueChange={field.handleChange}
											value={field.state.value}
										>
											<SelectTrigger className="w-40">
												<SelectValue placeholder="Velg ikon" />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(cardIcons).map(([key, Icon]) => (
													<SelectItem key={key} value={key}>
														<React.Fragment>
															<Icon className="h-4 w-4" />
															<span className="capitalize">{key}</span>
														</React.Fragment>
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
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Sammendrag</FieldLabel>
									<FieldDescription>
										Et kort beskrivende sammendrag av ressursen
									</FieldDescription>
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
									<FieldDescription>
										En kort beskrivelse/sammendrag av ressursen
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
					<FieldSeparator />
					<form.Field name="content">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;

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

				<div className="flex flex-row gap-2">
					<Button
						type="button"
						disabled={form.state.isSubmitting}
						onClick={() => form.handleSubmit({ submitAction: "primary" })}
					>
						<Send />{" "}
						{form.state.isSubmitting ? "Jobber..." : "Lagre og publiser"}
					</Button>
					<Button
						type="button"
						disabled={form.state.isSubmitting}
						variant="secondary"
						onClick={() => form.handleSubmit({ submitAction: "secondary" })}
					>
						<Save /> {form.state.isSubmitting ? "Jobber..." : "Lagre"}
					</Button>
					{onTertiarySubmitAction && (
						<Button
							type="button"
							disabled={form.state.isSubmitting}
							variant="destructive"
							onClick={() => form.handleSubmit({ submitAction: "tertiary" })}
						>
							<EyeOff />{" "}
							{form.state.isSubmitting ? "Jobber..." : "Lagre og avpubliser"}
						</Button>
					)}
				</div>
			</FieldSet>
		</form>
	);
}
