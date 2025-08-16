"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@workspace/ui/components//button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components//form";
import { Input } from "@workspace/ui/components//input";
import { Separator } from "@workspace/ui/components//separator";
import { EyeOff, Save, Send } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { EditorMenu } from "@/components/common/markdown-editor/markdown-editor";
import { type PageFormValues, pageSchema } from "@/constants/schemas/page-form-schema";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";

export default function PageForm({
	defaultValues,
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
}: {
	defaultValues: PageFormValues;
	onPrimarySubmitAction: (values: PageFormValues) => void;
	onSecondarySubmitAction: (values: PageFormValues) => void;
	onTertiarySubmitAction?: (values: PageFormValues) => void;
}) {
	const form = useForm<PageFormValues>({
		resolver: zodV4Resolver(pageSchema),
		defaultValues,
	});

	const handleEditorUpdate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setValue("content", editor.getHTML());
		},
		[form],
	);

	const handleEditorCreate = useCallback(
		({ editor }: { editor: { getHTML: () => string } }) => {
			form.setValue("content", editor.getHTML());
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
		content: form.watch("content"),
		onCreate: handleEditorCreate,
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onPrimarySubmitAction)} className='space-y-4'>
				<FormField
					control={form.control}
					name='title'
					render={({ field }) => (
						<FormItem className='flex-1'>
							<FormLabel>Tittel</FormLabel>
							<FormControl>
								<Input placeholder='Tittel' {...field} />
							</FormControl>
							<FormDescription>En kort informativ tittel som beskriver siden</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Separator className='my-4' />
				<FormField
					control={form.control}
					name='content'
					render={() => (
						<FormItem>
							<FormLabel>Innhold</FormLabel>
							<FormControl>
								<div className='min-h-[60vh] overflow-clip rounded-md border'>
									<EditorMenu editor={editor} />
									<EditorContent editor={editor} />
								</div>
							</FormControl>
							<FormDescription>Innholdet på siden</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className='flex flex-wrap gap-4'>
					<Button
						type='submit'
						disabled={form.formState.isSubmitting}
						onClick={form.handleSubmit(onPrimarySubmitAction)}
					>
						<Send /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
					</Button>
					<Button
						type='submit'
						disabled={form.formState.isSubmitting}
						variant='secondary'
						onClick={form.handleSubmit(onSecondarySubmitAction)}
					>
						<Save /> {form.formState.isSubmitting ? "Jobber..." : "Lagre"}
					</Button>
					{onTertiarySubmitAction && (
						<Button
							type='submit'
							disabled={form.formState.isSubmitting}
							variant='destructive'
							onClick={form.handleSubmit(onTertiarySubmitAction)}
						>
							<EyeOff /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og avpubliser"}
						</Button>
					)}
				</div>
			</form>
		</Form>
	);
}
