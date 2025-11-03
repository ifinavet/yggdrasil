"use client";

import { type Editor, isNodeSelection } from "@tiptap/react";
// --- Styles ---
import { Button } from "@workspace/ui/components//button";
import { Input } from "@workspace/ui/components//input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@workspace/ui/components//popover";
import { Separator } from "@workspace/ui/components//separator";
import { CornerDownLeft, ExternalLink, Link, Trash } from "lucide-react";
import * as React from "react";
// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor";
// --- Lib ---
import { isMarkInSchema } from "@/utils/tiptap-utils";

export interface LinkHandlerProps {
	readonly editor: Editor | null;
	readonly onSetLink?: () => void;
	readonly onLinkActive?: () => void;
}

export interface LinkMainProps {
	readonly url: string;
	readonly setUrl: React.Dispatch<React.SetStateAction<string>>;
	readonly setLink: () => void;
	readonly removeLink: () => void;
	readonly isActive: boolean;
}

export const useLinkHandler = (props: Readonly<LinkHandlerProps>) => {
	const { editor, onSetLink, onLinkActive } = props;
	const [url, setUrl] = React.useState<string>("");

	React.useEffect(() => {
		if (!editor) return;

		// Get URL immediately on mount
		const { href } = editor.getAttributes("link");

		if (editor.isActive("link") && !url) {
			setUrl(href || "");
			onLinkActive?.();
		}
	}, [editor, onLinkActive, url]);

	React.useEffect(() => {
		if (!editor) return;

		const updateLinkState = () => {
			const { href } = editor.getAttributes("link");
			setUrl(href || "");

			if (editor.isActive("link") && !url) {
				onLinkActive?.();
			}
		};

		editor.on("selectionUpdate", updateLinkState);
		return () => {
			editor.off("selectionUpdate", updateLinkState);
		};
	}, [editor, onLinkActive, url]);

	const setLink = React.useCallback(() => {
		if (!url || !editor) return;

		const { from, to } = editor.state.selection;
		const text = editor.state.doc.textBetween(from, to);

		editor
			.chain()
			.focus()
			.extendMarkRange("link")
			.insertContent({
				type: "text",
				text: text || url,
				marks: [{ type: "link", attrs: { href: url } }],
			})
			.run();

		onSetLink?.();
	}, [editor, onSetLink, url]);

	const removeLink = React.useCallback(() => {
		if (!editor) return;
		editor
			.chain()
			.focus()
			.unsetMark("link", { extendEmptyMarkRange: true })
			.setMeta("preventAutolink", true)
			.run();
		setUrl("");
	}, [editor]);

	return {
		url,
		setUrl,
		setLink,
		removeLink,
		isActive: editor?.isActive("link") || false,
	};
};

export const LinkContent: React.FC<
	Readonly<{
		editor?: Editor | null;
	}>
> = ({ editor: providedEditor }) => {
	const editor = useTiptapEditor(providedEditor);

	const linkHandler = useLinkHandler({
		editor: editor,
	});

	return <LinkMain {...linkHandler} />;
};

const LinkMain: React.FC<Readonly<LinkMainProps>> = ({
	url,
	setUrl,
	setLink,
	removeLink,
	isActive,
}) => {
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			setLink();
		}
	};

	return (
		<div className="flex gap-2">
			<Input
				type="url"
				placeholder="Paste a link..."
				value={url}
				onChange={(e) => setUrl(e.target.value)}
				onKeyDown={handleKeyDown}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				className="min-w-[200px]"
			/>

			<div className="tiptap-button-group" data-orientation="horizontal">
				<Button
					type="button"
					onClick={setLink}
					title="Apply link"
					disabled={!url && !isActive}
					variant="ghost"
				>
					<CornerDownLeft size={18} />
				</Button>
			</div>

			<Separator
				orientation="vertical"
				className="data-[orientation=vertical]:h-8"
			/>

			<div className="flex gap-2">
				<Button
					type="button"
					onClick={() => window.open(url, "_blank")}
					title="Open in new window"
					disabled={!url && !isActive}
					variant="ghost"
				>
					<ExternalLink size={18} />
				</Button>

				<Button
					type="button"
					onClick={removeLink}
					title="Remove link"
					disabled={!url && !isActive}
					variant="ghost"
				>
					<Trash size={18} />
				</Button>
			</div>
		</div>
	);
};

export interface LinkPopoverProps {
	/**
	 * The TipTap editor instance.
	 */
	readonly editor?: Editor | null;
	/**
	 * Whether to hide the link popover.
	 * @default false
	 */
	readonly hideWhenUnavailable?: boolean;
	/**
	 * Callback for when the popover opens or closes.
	 */
	readonly onOpenChange?: (isOpen: boolean) => void;
	/**
	 * Whether to automatically open the popover when a link is active.
	 * @default true
	 */
	readonly autoOpenOnLinkActive?: boolean;
}

export function LinkPopover({
	editor: providedEditor,
	hideWhenUnavailable = false,
	onOpenChange,
	autoOpenOnLinkActive = true,
}: Readonly<LinkPopoverProps>) {
	const editor = useTiptapEditor(providedEditor);

	const linkInSchema = isMarkInSchema("link", editor);

	const [isOpen, setIsOpen] = React.useState(false);

	const onSetLink = () => {
		setIsOpen(false);
	};

	const onLinkActive = () => setIsOpen(autoOpenOnLinkActive);

	const linkHandler = useLinkHandler({
		editor: editor,
		onSetLink,
		onLinkActive,
	});

	const isDisabled = React.useMemo(() => {
		if (!editor) return true;
		if (editor.isActive("codeBlock")) return true;
		return !editor.can().setLink?.({ href: "" });
	}, [editor]);

	const canSetLink = React.useMemo(() => {
		if (!editor) return false;
		try {
			return editor.can().setMark("link");
		} catch {
			return false;
		}
	}, [editor]);

	const isActive = editor?.isActive("link") ?? false;

	const handleOnOpenChange = React.useCallback(
		(nextIsOpen: boolean) => {
			setIsOpen(nextIsOpen);
			onOpenChange?.(nextIsOpen);
		},
		[onOpenChange],
	);

	const show = React.useMemo(() => {
		if (!linkInSchema || !editor) {
			return false;
		}

		if (hideWhenUnavailable) {
			if (isNodeSelection(editor.state.selection) || !canSetLink) {
				return false;
			}
		}

		return true;
	}, [linkInSchema, hideWhenUnavailable, editor, canSetLink]);

	if (!show || !editor || !editor.isEditable) {
		return null;
	}

	return (
		<Popover open={isOpen} onOpenChange={handleOnOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					tabIndex={-1}
					aria-label="Link"
					disabled={isDisabled}
					data-active-state={isActive ? "on" : "off"}
					data-disabled={isDisabled}
					className="p-1"
				>
					<Link size={18} />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-fit">
				<LinkMain {...linkHandler} />
			</PopoverContent>
		</Popover>
	);
}
