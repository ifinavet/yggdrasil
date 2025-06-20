"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { EyeOff, Save, Send } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { zodv4Resolver } from "@/lib/zod-v4-resolver";
import {
  type ResourceFormValues,
  resourceSchema,
} from "@/utils/bifrost/schemas/resource-form-schema";
import { EditorMenu } from "../markdown-editor";

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
    resolver: zodv4Resolver(resourceSchema),
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
        placeholder:
          "Skriv en helt fantaskisk ressurs som alle i Navet kan ha glede av å lese!",
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
      <form
        onSubmit={form.handleSubmit(onPrimarySubmitAction)}
        className="space-y-4"
      >
        <div className="flex w-full flex-wrap gap-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Tittel</FormLabel>
                <FormControl>
                  <Input placeholder="Tittel" {...field} />
                </FormControl>
                <FormDescription>
                  En kort informativ tittel som beskriver ressursen
                </FormDescription>
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
        </div>

        <FormField
          control={form.control}
          name="excerpt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sammendrag</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Et kort beskrivende sammendrag av ressursen"
                />
              </FormControl>
              <FormDescription>
                En kort beskrivelse/sammendrag av ressursen
              </FormDescription>
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
                <div className="border rounded-md min-h-[50vh] overflow-clip">
                  <EditorMenu editor={editor} />
                  <EditorContent editor={editor} />
                </div>
              </FormControl>
              <FormDescription>Innholdet til ressursen</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-4 flex-wrap">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            onClick={form.handleSubmit(onPrimarySubmitAction)}
          >
            <Send />{" "}
            {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
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
              <EyeOff />{" "}
              {form.formState.isSubmitting
                ? "Jobber..."
                : "Lagre og avpubliser"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
