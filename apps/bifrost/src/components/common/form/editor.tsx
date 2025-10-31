"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components//form";
import { useCallback, useMemo } from "react";
import type {
	FieldValues,
	Path,
	PathValue,
	UseFormReturn,
} from "react-hook-form";
import ContentEditor from "@/components/common/markdown-editor/markdown-editor";

export default function DescriptionEditor<TFieldValues extends FieldValues>({
	title = "Beskrivelse",
	description = "Dette er beskrivelsen.",
	form,
	fieldName = "description" as Path<TFieldValues>,
}: {
	title: string;
	description: string;
	form: UseFormReturn<TFieldValues>;
	fieldName?: Path<TFieldValues>;
}) {
	const handleEditorUpdate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setValue(
				fieldName as Path<TFieldValues>,
				editor.getHTML() as PathValue<TFieldValues, Path<TFieldValues>>,
			);
		},
		[form, fieldName],
	);

	const handleEditorCreate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setValue(
				fieldName as Path<TFieldValues>,
				editor.getHTML() as PathValue<TFieldValues, Path<TFieldValues>>,
			);
		},
		[form, fieldName],
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
		content: form.watch(fieldName as Path<TFieldValues>),
		onCreate: handleEditorCreate,
	});

	return (
		<FormField
			control={form.control}
			name={fieldName as Path<TFieldValues>}
			render={() => (
				<FormItem className="flex flex-col">
					<FormLabel>{title} </FormLabel>
					<FormControl>
						<ContentEditor editor={editor} />
					</FormControl>
					<FormDescription>{description}</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
