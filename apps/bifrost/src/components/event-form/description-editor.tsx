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
import type { UseFormReturn } from "react-hook-form";
import type { EventFormValues } from "@/utils/schemas/event-form-schema";
import ContentEditor from "../markdown-editor";

export default function DescriptionEditor({ form }: { form: UseFormReturn<EventFormValues> }) {
	const handleEditorUpdate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setValue("description", editor.getHTML());
		},
		[form],
	);

	const handleEditorCreate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setValue("description", editor.getHTML());
		},
		[form],
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
					"prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert text-black",
			},
		}),
		[],
	);

	const editor = useEditor({
		extensions: editorExtensions,
		editorProps: editorProps,
		onUpdate: handleEditorUpdate,
		immediatelyRender: false,
		content: form.watch("description"),
		onCreate: handleEditorCreate,
	});

	return (
		<FormField
			control={form.control}
			name='description'
			render={() => (
				<FormItem className='flex flex-col'>
					<FormLabel>Beskrivelse</FormLabel>
					<FormControl>
						<ContentEditor editor={editor} />
					</FormControl>
					<FormDescription>Dette er beskrivelsen av arrangementet.</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
