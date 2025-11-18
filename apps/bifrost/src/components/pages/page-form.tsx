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
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { EyeOff, Save, Send } from "lucide-react";
import { useCallback, useMemo } from "react";
import { EditorMenu } from "@/components/common/forms/markdown-editor/markdown-editor";
import {
	type PageFormValues,
	pageSchema,
} from "@/constants/schemas/page-form-schema";

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
				placeholder: "Lag en bra side, foreksempel en personvernerklæring",
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
			className="space-y-2"
		>
			<FieldSet>
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
									En kort informativ tittel som beskriver siden.
								</FieldDescription>
							</Field>
						);
					}}
				</form.Field>

				<Separator className="my-4" />

				<form.Field name="content">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
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

			<div className="flex flex-wrap gap-4">
				<Button
					type="button"
					disabled={form.state.isSubmitting}
					onClick={() => form.handleSubmit({ submitAction: "primary" })}
				>
					<Send /> {form.state.isSubmitting ? "Jobber..." : "Lagre og publiser"}
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
		</form>
	);
}
