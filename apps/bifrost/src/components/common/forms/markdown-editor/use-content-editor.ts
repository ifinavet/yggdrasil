"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useMemo } from "react";

const EMPTY_EDITOR_PLACEHOLDER_CLASS =
	"before:content-[attr(data-placeholder)] before:float-left before:text-muted-foreground before:h-0 before:pointer-events-none";

const PROSE_CLASS =
	"prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert";

export function contentExtensions({
	placeholder,
	markdown,
}: Readonly<{ placeholder: string; markdown: boolean }>) {
	return [
		markdown ? StarterKit.configure({ link: false, underline: false }) : StarterKit,
		Placeholder.configure({
			emptyEditorClass: EMPTY_EDITOR_PLACEHOLDER_CLASS,
			placeholder,
		}),
		...(markdown ? [Markdown] : [Underline]),
		Link.configure({
			openOnClick: false,
			defaultProtocol: "https",
			protocols: markdown ? ["https", "mailto"] : ["https", "mailto", "tel"],
			autolink: true,
		}),
	];
}

export function useContentEditor({
	placeholder,
	initialContent,
	onContentChange,
	markdown = false,
}: Readonly<{
	placeholder: string;
	initialContent: string;
	onContentChange: (content: string) => void;
	markdown?: boolean;
}>) {
	const captureContent = useCallback(
		({ editor }: { editor: Editor }) => {
			onContentChange(markdown ? editor.getMarkdown() : editor.getHTML());
		},
		[onContentChange, markdown],
	);

	const extensions = useMemo(
		() => contentExtensions({ placeholder, markdown }),
		[placeholder, markdown],
	);

	const editorProps = useMemo(() => ({ attributes: { class: PROSE_CLASS } }), []);

	return useEditor({
		extensions,
		editorProps,
		onUpdate: captureContent,
		onCreate: captureContent,
		immediatelyRender: false,
		content: initialContent,
		contentType: markdown ? "markdown" : "html",
	});
}
