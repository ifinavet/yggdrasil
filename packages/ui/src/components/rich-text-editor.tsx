"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import {
	Bold,
	Heading2,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	type LucideIcon,
	Underline,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

type RichTextEditorProps = Readonly<{
	id?: string;
	value: string;
	onChange: (html: string) => void;
	onBlur?: () => void;
	placeholder?: string;
	invalid?: boolean;
	labels?: Partial<ToolbarLabels>;
	className?: string;
}>;

type ToolbarLabels = {
	bold: string;
	italic: string;
	underline: string;
	heading: string;
	bulletList: string;
	orderedList: string;
	link: string;
	linkUrl: string;
	linkSave: string;
	linkRemove: string;
};

const DEFAULT_LABELS: ToolbarLabels = {
	bold: "Fet",
	italic: "Kursiv",
	underline: "Understreket",
	heading: "Overskrift",
	bulletList: "Punktliste",
	orderedList: "Nummerert liste",
	link: "Lenke",
	linkUrl: "Adresse",
	linkSave: "Lagre lenke",
	linkRemove: "Fjern lenke",
};

const EMPTY_DOCUMENT = "<p></p>";

function normalize(html: string) {
	return html === EMPTY_DOCUMENT ? "" : html;
}

export function RichTextEditor({
	id,
	value,
	onChange,
	onBlur,
	placeholder,
	invalid,
	labels,
	className,
}: RichTextEditorProps) {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: { levels: [2, 3] },
				code: false,
				codeBlock: false,
				horizontalRule: false,
				strike: false,
				link: {
					openOnClick: false,
					autolink: true,
					defaultProtocol: "https",
					protocols: ["https", "mailto"],
				},
			}),
			Placeholder.configure({
				placeholder: placeholder ?? "",
				emptyEditorClass:
					"before:pointer-events-none before:float-left before:h-0 before:text-muted-foreground before:content-[attr(data-placeholder)]",
			}),
		],
		content: value,
		editorProps: {
			attributes: {
				...(id ? { id } : {}),
				"aria-invalid": invalid ? "true" : "false",
				class: "prose prose-sm dark:prose-invert min-h-40 max-w-none px-4 py-3 focus:outline-none",
			},
		},
		onUpdate: ({ editor: current }) => onChange(normalize(current.getHTML())),
		onBlur: () => onBlur?.(),
	});

	useEffect(() => {
		if (!editor || editor.isFocused) return;
		if (normalize(editor.getHTML()) !== value) {
			editor.commands.setContent(value, { emitUpdate: false });
		}
	}, [editor, value]);

	return (
		<div
			data-invalid={invalid}
			className={cn(
				"rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 data-[invalid=true]:border-destructive",
				className,
			)}
		>
			{editor && <Toolbar editor={editor} labels={{ ...DEFAULT_LABELS, ...labels }} />}
			<EditorContent editor={editor} />
		</div>
	);
}

function Toolbar({ editor, labels }: Readonly<{ editor: Editor; labels: ToolbarLabels }>) {
	const active = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			bold: current.isActive("bold"),
			italic: current.isActive("italic"),
			underline: current.isActive("underline"),
			heading: current.isActive("heading", { level: 2 }),
			bulletList: current.isActive("bulletList"),
			orderedList: current.isActive("orderedList"),
			link: current.isActive("link"),
		}),
	});

	const tools: { key: keyof typeof active; icon: LucideIcon; run: () => void }[] = [
		{ key: "bold", icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
		{ key: "italic", icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
		{ key: "underline", icon: Underline, run: () => editor.chain().focus().toggleUnderline().run() },
		{
			key: "heading",
			icon: Heading2,
			run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
		},
		{ key: "bulletList", icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
		{
			key: "orderedList",
			icon: ListOrdered,
			run: () => editor.chain().focus().toggleOrderedList().run(),
		},
	];

	return (
		<div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
			{tools.map(({ key, icon: Icon, run }) => (
				<ToolButton key={key} label={labels[key]} pressed={active[key]} onClick={run}>
					<Icon className="size-4" />
				</ToolButton>
			))}
			<LinkTool editor={editor} labels={labels} pressed={active.link} />
		</div>
	);
}

function ToolButton({
	label,
	pressed,
	onClick,
	children,
}: Readonly<{ label: string; pressed: boolean; onClick?: () => void; children: React.ReactNode }>) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={label}
			title={label}
			aria-pressed={pressed}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
			className="size-8 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
		>
			{children}
		</Button>
	);
}

function LinkTool({
	editor,
	labels,
	pressed,
}: Readonly<{ editor: Editor; labels: ToolbarLabels; pressed: boolean }>) {
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("");

	const openChange = (next: boolean) => {
		if (next) setUrl(editor.getAttributes("link").href ?? "");
		setOpen(next);
	};

	const save = (event: FormEvent) => {
		event.preventDefault();
		const chain = editor.chain().focus().extendMarkRange("link");
		if (url.trim()) chain.setLink({ href: url.trim() }).run();
		else chain.unsetLink().run();
		setOpen(false);
	};

	const remove = () => {
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={openChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={labels.link}
					title={labels.link}
					aria-pressed={pressed}
					className="size-8 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
				>
					<LinkIcon className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80">
				<form onSubmit={save} className="flex flex-col gap-2">
					<Input
						type="url"
						inputMode="url"
						aria-label={labels.linkUrl}
						placeholder="https://"
						value={url}
						onChange={(event) => setUrl(event.target.value)}
					/>
					<div className="flex justify-end gap-2">
						{pressed && (
							<Button type="button" variant="ghost" size="sm" onClick={remove}>
								{labels.linkRemove}
							</Button>
						)}
						<Button type="submit" size="sm">
							{labels.linkSave}
						</Button>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
}
