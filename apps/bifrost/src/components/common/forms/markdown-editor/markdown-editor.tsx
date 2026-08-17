import { type Editor, EditorContent, useEditorState } from "@tiptap/react";
import { Separator } from "@workspace/ui/components//separator";
import {
	Bold,
	CodeXml,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	List,
	Strikethrough,
	Underline,
} from "lucide-react";
import type React from "react";
import { memo, useCallback } from "react";
import { LinkPopover } from "./link-popover";

const ToolButton = memo(function ToolButton({
	children,
	editor,
	onButtonClick,
	isActive,
	...buttonProps
}: Readonly<
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: React.ReactNode;
		editor: Editor;
		isActive?: boolean;
		onButtonClick: () => void;
	}
>) {
	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			onButtonClick();
		},
		[onButtonClick],
	);

	return (
		<button
			{...buttonProps}
			onClick={handleClick}
			className={`rounded-sm p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${isActive ? "bg-zinc-200 dark:bg-zinc-950" : ""} ${buttonProps.className}`}
		>
			{children}
		</button>
	);
});

export const EditorMenu = memo(function EditorMenu({
	editor,
}: Readonly<{
	editor: Editor | null;
}>) {
	const editorState = useEditorState({
		editor,
		selector: ({ editor: currentEditor }) => ({
			heading1: currentEditor?.isActive("heading", { level: 1 }) ?? false,
			heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
			heading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
			bold: currentEditor?.isActive("bold") ?? false,
			italic: currentEditor?.isActive("italic") ?? false,
			strike: currentEditor?.isActive("strike") ?? false,
			codeBlock: currentEditor?.isActive("codeBlock") ?? false,
			underline: currentEditor?.isActive("underline") ?? false,
			bulletList: currentEditor?.isActive("bulletList") ?? false,
		}),
	});

	const toggleHeading1 = useCallback(() => {
		editor?.chain().focus().toggleHeading({ level: 1 }).run();
	}, [editor]);

	const toggleHeading2 = useCallback(() => {
		editor?.chain().focus().toggleHeading({ level: 2 }).run();
	}, [editor]);

	const toggleHeading3 = useCallback(() => {
		editor?.chain().focus().toggleHeading({ level: 3 }).run();
	}, [editor]);

	const toggleBold = useCallback(() => {
		editor?.chain().focus().toggleBold().run();
	}, [editor]);

	const toggleItalic = useCallback(() => {
		editor?.chain().focus().toggleItalic().run();
	}, [editor]);

	const toggleStrike = useCallback(() => {
		editor?.chain().focus().toggleStrike().run();
	}, [editor]);

	const toggleCodeBlock = useCallback(() => {
		editor?.chain().focus().toggleCodeBlock().run();
	}, [editor]);

	const toggleUnderline = useCallback(() => {
		editor?.chain().focus().toggleUnderline().run();
	}, [editor]);

	const toggleBulletList = useCallback(() => {
		editor?.chain().focus().toggleBulletList().run();
	}, [editor]);

	if (!editor) {
		return null;
	}

	return (
		<div className="flex flex-wrap gap-4 bg-zinc-50 p-2 dark:bg-zinc-900">
			<div className="flex gap-2">
				<ToolButton
					editor={editor}
					onButtonClick={toggleHeading1}
					isActive={editorState?.heading1}
				>
					<Heading1 size={18} />
				</ToolButton>
				<ToolButton
					editor={editor}
					onButtonClick={toggleHeading2}
					isActive={editorState?.heading2}
				>
					<Heading2 size={18} />
				</ToolButton>
				<ToolButton
					editor={editor}
					onButtonClick={toggleHeading3}
					isActive={editorState?.heading3}
				>
					<Heading3 size={18} />
				</ToolButton>
			</div>
			<Separator
				orientation="vertical"
				className="data-[orientation=vertical]:h-8"
			/>
			<div className="flex gap-2">
				<ToolButton
					editor={editor}
					onButtonClick={toggleBold}
					isActive={editorState?.bold}
				>
					<Bold size={18} />
				</ToolButton>
				<ToolButton
					editor={editor}
					onButtonClick={toggleItalic}
					isActive={editorState?.italic}
				>
					<Italic size={18} />
				</ToolButton>
				<ToolButton
					editor={editor}
					onButtonClick={toggleStrike}
					isActive={editorState?.strike}
				>
					<Strikethrough size={18} />
				</ToolButton>

				<LinkPopover editor={editor} />

				<ToolButton
					editor={editor}
					onButtonClick={toggleCodeBlock}
					isActive={editorState?.codeBlock}
				>
					<CodeXml size={18} />
				</ToolButton>
				<ToolButton
					editor={editor}
					onButtonClick={toggleUnderline}
					isActive={editorState?.underline}
				>
					<Underline size={18} />
				</ToolButton>
			</div>
			<Separator
				orientation="vertical"
				className="data-[orientation=vertical]:h-8"
			/>
			<div className="flex gap-2">
				<ToolButton
					editor={editor}
					onButtonClick={toggleBulletList}
					isActive={editorState?.bulletList}
				>
					<List size={18} />
				</ToolButton>
			</div>
		</div>
	);
});

const ContentEditor = memo(function ContentEditor({
	editor,
}: Readonly<{
	editor: Editor | null;
}>) {
	if (!editor) {
		return null;
	}

	return (
		<div className="flex max-w-full flex-col-reverse overflow-hidden rounded-lg border border-gray">
			<div className="wrap-break-word horizontal no-scrollbar mb-2 h-96 w-full overflow-scroll overflow-x-hidden scroll-auto">
				<EditorContent
					editor={editor}
					className="max-h-24 max-w-[80ch] scroll-auto text-black sm:p-2 dark:text-white"
				/>
			</div>
			<Separator />
			<EditorMenu editor={editor} />
		</div>
	);
});

export default ContentEditor;
