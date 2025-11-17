"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@workspace/ui/components/field";
import { useCallback, useMemo } from "react";
import ContentEditor from "@/components/common/forms/markdown-editor/markdown-editor";

export default function DescriptionEditor({
	title = "Beskrivelse",
	description = "Dette er beskrivelsen.",
	field,
}: Readonly<{
	title?: string;
	description?: string;
	field: {
		name: string;
		state: {
			value: string;
			meta: {
				isTouched: boolean;
				isValid: boolean;
				errors: Array<{ message?: string } | undefined>;
			};
		};
		handleChange: (value: string) => void;
		handleBlur: () => void;
	};
}>) {
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	const handleEditorUpdate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			field.handleChange(editor.getHTML());
		},
		[field],
	);

	const handleEditorCreate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			field.handleChange(editor.getHTML());
		},
		[field],
	);

	const editorExtensions = useMemo(
		() => [
			StarterKit,
			Placeholder.configure({
				emptyEditorClass:
					"before:content-[attr(data-placeholder)] before:float-left before:text-muted-foreground before:h-0 before:pointer-events-none",
				placeholder: "Skriv en kjempe kul beskrivelse av arrangementet...",
			}),
			Underline,
			Link.configure({
				openOnClick: true,
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
					"prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert text-black dark:text-white",
			},
		}),
		[],
	);

	const editor = useEditor({
		extensions: editorExtensions,
		editorProps: editorProps,
		onUpdate: handleEditorUpdate,
		immediatelyRender: false,
		content: field.state.value,
		onCreate: handleEditorCreate,
	});

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name}>{title}</FieldLabel>
			<ContentEditor editor={editor} />
			<FieldDescription>{description}</FieldDescription>
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
