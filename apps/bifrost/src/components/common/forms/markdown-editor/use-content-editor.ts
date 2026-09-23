"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useMemo } from "react";

const EMPTY_EDITOR_PLACEHOLDER_CLASS =
	"before:content-[attr(data-placeholder)] before:float-left before:text-muted-foreground before:h-0 before:pointer-events-none";

const PROSE_CLASS =
	"prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert";

export function useContentEditor({
	placeholder,
	initialContent,
	onContentChange,
}: Readonly<{
	placeholder: string;
	initialContent: string;
	onContentChange: (html: string) => void;
}>) {
	const captureContent = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			onContentChange(editor.getHTML());
		},
		[onContentChange],
	);

	const extensions = useMemo(
		() => [
			StarterKit,
			Placeholder.configure({
				emptyEditorClass: EMPTY_EDITOR_PLACEHOLDER_CLASS,
				placeholder,
			}),
			Underline,
			Link.configure({
				openOnClick: false,
				defaultProtocol: "https",
				protocols: ["https", "mailto", "tel"],
				autolink: true,
			}),
		],
		[placeholder],
	);

	const editorProps = useMemo(() => ({ attributes: { class: PROSE_CLASS } }), []);

	return useEditor({
		extensions,
		editorProps,
		onUpdate: captureContent,
		onCreate: captureContent,
		immediatelyRender: false,
		content: initialContent,
	});
}
