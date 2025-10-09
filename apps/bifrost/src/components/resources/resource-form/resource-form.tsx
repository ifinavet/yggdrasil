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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components//select";
import { Separator } from "@workspace/ui/components//separator";
import { Textarea } from "@workspace/ui/components//textarea";
import { EyeOff, Save, Send } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { EditorMenu } from "@/components/common/markdown-editor/markdown-editor";
import { cardIcons } from "@/constants/resource-constants";
import { type ResourceFormValues, resourceSchema } from "@/constants/schemas/resource-form-schema";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";

export default function ResourceForm({
	defaultValues,
	onPrimarySubmitAction,
	onSecondarySubmitAction,
	onTertiarySubmitAction,
}: {
	defaultValues: ResourceFormValues;
	onPrimarySubmitAction: (values: ResourceFormValues) => void;
	onSecondarySubmitAction: (values: ResourceFormValues) => void;
	onTertiarySubmitAction?: (values: ResourceFormValues) => void;
}) {
	const form = useForm<ResourceFormValues>({
		resolver: zodV4Resolver(resourceSchema),
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
				placeholder: "Skriv en helt fantaskisk ressurs som alle i Navet kan ha glede av å lese!",
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
			<form onSubmit={form.handleSubmit(onPrimarySubmitAction)} className="space-y-4">
				<div className="flex w-full flex-wrap gap-4">
					<FormField
						control={form.control}
						name="title"
						render={({ field }) => (
							<FormItem className="flex-1">
								<FormLabel>Tittel</FormLabel>
								<FormControl>
									<Input placeholder="Tittel" {...field} />
								</FormControl>
								<FormDescription>En kort informativ tittel som beskriver ressursen</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="tag"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Tag</FormLabel>
								<FormControl>
									<Input placeholder="f.eks how-to-bedpress" {...field} />
								</FormControl>
								<FormDescription>
									En tag for å grupere ressurser med samme tema eller fokus
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="icon"
						render={({ field }) => {
							return (
								<FormItem>
									<FormLabel>Icon</FormLabel>
									<FormControl>
										<div className="flex items-center gap-2">
											<Select onValueChange={field.onChange} value={field.value}>
												<SelectTrigger className="w-[160px]">
													<SelectValue placeholder="Velg ikon" />
												</SelectTrigger>
												<SelectContent>
													{Object.entries(cardIcons).map(([key, Icon]) => (
														<SelectItem key={key} value={key}>
															<>
																<Icon className="h-4 w-4" />
																<span className="capitalize">{key}</span>
															</>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</FormControl>
									<FormDescription>Velg et icon.</FormDescription>
									<FormMessage />
								</FormItem>
							);
						}}
					/>
				</div>

				<FormField
					control={form.control}
					name="excerpt"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Sammendrag</FormLabel>
							<FormControl>
								<Textarea {...field} placeholder="Et kort beskrivende sammendrag av ressursen" />
							</FormControl>
							<FormDescription>En kort beskrivelse/sammendrag av ressursen</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Separator className="my-4" />
				<FormField
					control={form.control}
					name="content"
					render={() => (
						<FormItem>
							<FormLabel>Innhold</FormLabel>
							<FormControl>
								<div className="min-h-[50vh] overflow-clip rounded-md border">
									<EditorMenu editor={editor} />
									<EditorContent editor={editor} />
								</div>
							</FormControl>
							<FormDescription>Innholdet til ressursen</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex flex-wrap gap-4">
					<Button
						type="submit"
						disabled={form.formState.isSubmitting}
						onClick={form.handleSubmit(onPrimarySubmitAction)}
					>
						<Send /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
					</Button>
					<Button
						type="submit"
						disabled={form.formState.isSubmitting}
						variant="secondary"
						onClick={form.handleSubmit(onSecondarySubmitAction)}
					>
						<Save /> {form.formState.isSubmitting ? "Jobber..." : "Lagre"}
					</Button>
					{onTertiarySubmitAction && (
						<Button
							type="submit"
							disabled={form.formState.isSubmitting}
							variant="destructive"
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
