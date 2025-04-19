import {Separator} from "@/components/ui/separator";
import {type Editor, EditorContent} from "@tiptap/react";
import {Bold, CodeXml, Heading1, Heading2, Heading3, Italic, List, Strikethrough} from "lucide-react";
import type React from "react";

function ToolButton({
    children,
    editor,
    onButtonClick,
    isActive,
    ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    editor: Editor;
    isActive?: boolean;
    onButtonClick: () => void;
}) {
    return (
        <button
            {...buttonProps}
            onClick={(e) => {
                e.preventDefault();
                onButtonClick();
            }}
            className={`rounded-sm hover:bg-zinc-100 p-1 ${isActive ? "bg-zinc-200" : ""} ${buttonProps.className}`}
        >
            {children}
        </button>
    );
}

function EditorMenu({ editor }: { editor: Editor | null }) {
    if (!editor) {
        return null;
    }

    return (
        <div className='flex gap-4 p-2 bg-zinc-50 flex-wrap'>
            <div className='flex gap-2'>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive("heading", { level: 1 })}
                >
                    <Heading1 size={18} />
                </ToolButton>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive("heading", { level: 2 })}
                >
                    <Heading2 size={18} />
                </ToolButton>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive("heading", { level: 3 })}
                >
                    <Heading3 size={18} />
                </ToolButton>
            </div>
            <Separator orientation='vertical' className='data-[orientation=vertical]:h-8' />
            <div className='flex gap-2'>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                >
                    <Bold size={18} />
                </ToolButton>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                >
                    <Italic size={18} />
                </ToolButton>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive("strike")}
                >
                    <Strikethrough size={18} />
                </ToolButton>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    isActive={editor.isActive("codeBlock")}
                >
                    <CodeXml size={18} />
                </ToolButton>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive("codeBlock")}
                >
                    <CodeXml size={18} />
                </ToolButton>
            </div>
            <Separator orientation='vertical' className='data-[orientation=vertical]:h-8' />
            <div className='flex gap-2'>
                <ToolButton
                    editor={editor}
                    onButtonClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive("bulletList")}
                >
                    <List size={18} />
                </ToolButton>
            </div>
        </div>
    );
}

export default function ContentEditor({ editor }: { editor: Editor | null }) {
    if (!editor) {
        return null;
    }

    return (
        <div className='flex flex-col max-w-full border  border-gray rounded-lg overflow-hidden'>
            <EditorMenu editor={editor} />
            <Separator />
            <div className='mb-2 h-96 scroll-auto overflow-scroll'>
                <EditorContent editor={editor} className='sm:p-2 scroll-auto max-h-12' />
            </div>
        </div>
    );
}
