"use client";
import { useForm } from "@tanstack/react-form";
import { EditorContent } from "@tiptap/react";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	WIKI_CATEGORIES,
	WIKI_CATEGORY_KEYS,
	WIKI_FACT_KEYS,
	WIKI_FACTS,
	type WikiArticle,
	wikiArticleSchema,
} from "@workspace/shared/wiki";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { SafeHtml } from "@workspace/ui/components/safe-html";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { EditorMenu } from "@/components/common/forms/markdown-editor/markdown-editor";
import { useContentEditor } from "@/components/common/forms/markdown-editor/use-content-editor";
import { LiveFacts } from "./live-facts";
import { errorMessage, WikiLoading } from "./shared";

const emptyArticle: WikiArticle = {
	title: "",
	slug: "",
	excerpt: "",
	content:
		"<h2>Før du begynner</h2><p></p><h2>Slik gjør du det</h2><ol><li><p></p></li></ol><h2>Dette skjer automatisk</h2><p></p><h2>Sjekk at du er ferdig</h2><p></p><h2>Hvis noe går galt</h2><p></p>",
	category: "start",
	aliases: [],
	relatedSlugs: [],
	facts: [],
	owner: "Styret",
	policy: false,
};
const formSchema = wikiArticleSchema.extend({
	aliases: z.string().max(1600),
	relatedSlugs: z.string().max(1200),
});
const commaList = (value: string) =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
export function WikiEditPage({ slug }: Readonly<{ slug: string }>) {
	const data = useQuery(api.wiki.queries.edit, { slug });
	if (data === undefined) return <WikiLoading />;
	if (!data) return <p>Artikkelen ble ikke funnet.</p>;
	if (data.status === "retired")
		return (
			<p>Artikkelen er tatt ut av bruk. Gjenopprett en tidligere versjon fra historikken først.</p>
		);
	return (
		<WikiEditor
			key={data.resourceId}
			initial={data.article}
			resourceId={data.resourceId}
			initialVersion={data.editVersion}
		/>
	);
}
export function WikiEditor({
	initial = emptyArticle,
	resourceId,
	initialVersion = 0,
}: Readonly<{ initial?: WikiArticle; resourceId?: Id<"resources">; initialVersion?: number }>) {
	const save = useMutation(api.wiki.mutations.save);
	const router = useRouter();
	const [version, setVersion] = useState(initialVersion);
	const [id, setId] = useState(resourceId);
	const [preview, setPreview] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const form = useForm({
		defaultValues: {
			...initial,
			aliases: initial.aliases.join(", "),
			relatedSlugs: initial.relatedSlugs.join(", "),
		},
		validators: { onSubmit: formSchema },
		onSubmitMeta: { publish: false },
		onSubmit: async ({ value, meta, formApi }) => {
			setError(null);
			try {
				const article = {
					...value,
					aliases: commaList(value.aliases),
					relatedSlugs: commaList(value.relatedSlugs),
				};
				const result = await save({
					resourceId: id,
					expectedVersion: version,
					article,
					publish: meta.publish,
				});
				setVersion(result.editVersion);
				setId(result.resourceId);
				formApi.reset(value);
				toast.success(
					meta.publish
						? "Artikkelen er publisert"
						: "Utkastet er lagret. Publisert innhold er uendret.",
				);
				if (meta.publish) router.push(`/wiki/${result.slug}`);
				else if (!id) router.replace(`/wiki/${result.slug}/edit`);
			} catch (cause) {
				setError(errorMessage(cause));
			}
		},
	});
	const setContent = useCallback(
		(content: string) => form.setFieldValue("content", content),
		[form],
	);
	const editor = useContentEditor({
		placeholder: "Beskriv oppgaven med korte, konkrete steg…",
		initialContent: initial.content,
		onContentChange: setContent,
	});
	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (form.state.isDirty) event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [form]);
	return (
		<form
			className="space-y-6"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit({ publish: false });
			}}
		>
			<div>
				<Link
					href={id ? `/wiki/${initial.slug}` : "/wiki"}
					className="text-muted-foreground text-sm underline"
				>
					Tilbake til håndboken
				</Link>
				<h1 className="mt-3 font-semibold text-3xl">{id ? "Rediger artikkel" : "Ny artikkel"}</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Beskriv én oppgave. Lagre underveis og publiser når innholdet er klart.
				</p>
			</div>
			{error && (
				<div
					role="alert"
					className="rounded-lg border border-destructive p-4 text-destructive text-sm"
				>
					{error}
				</div>
			)}
			<div className="grid gap-5 md:grid-cols-2">
				{(
					[
						["title", "Tittel"],
						["slug", "Adresse etter /wiki/"],
						["owner", "Ansvarlig for innholdet"],
						["aliases", "Søkeord og alternative navn (komma mellom)"],
					] as const
				).map(([name, label]) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<Field>
								<FieldLabel htmlFor={`wiki-${name}`}>{label}</FieldLabel>
								<Input
									id={`wiki-${name}`}
									value={field.state.value}
									disabled={name === "slug" && Boolean(id)}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={!field.state.meta.isValid}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
				))}
			</div>
			<div className="grid gap-5 md:grid-cols-2">
				<form.Field name="category">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="wiki-category">Kategori</FieldLabel>
							<select
								id="wiki-category"
								value={field.state.value}
								onChange={(event) =>
									field.handleChange(event.target.value as WikiArticle["category"])
								}
								className="h-10 rounded-md border bg-background px-3 text-sm"
							>
								{WIKI_CATEGORY_KEYS.map((key) => (
									<option key={key} value={key}>
										{WIKI_CATEGORIES[key].title}
									</option>
								))}
							</select>
						</Field>
					)}
				</form.Field>
				<form.Field name="relatedSlugs">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="wiki-related">
								Relaterte artikkeladresser (komma mellom)
							</FieldLabel>
							<Input
								id="wiki-related"
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
			</div>
			<form.Field name="excerpt">
				{(field) => (
					<Field>
						<FieldLabel htmlFor="wiki-excerpt">Kort sammendrag</FieldLabel>
						<Textarea
							id="wiki-excerpt"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
							aria-invalid={!field.state.meta.isValid}
						/>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
			<div className="flex gap-2">
				<Button
					variant={preview ? "outline" : "secondary"}
					type="button"
					onClick={() => setPreview(false)}
				>
					Skriv
				</Button>
				<Button
					variant={preview ? "secondary" : "outline"}
					type="button"
					onClick={() => setPreview(true)}
				>
					Forhåndsvis
				</Button>
			</div>
			{preview ? (
				<form.Subscribe
					selector={(state) => ({ content: state.values.content, facts: state.values.facts })}
				>
					{({ content, facts }) => (
						<div className="space-y-5 rounded-lg border p-6">
							<SafeHtml html={content} className="prose dark:prose-invert max-w-none" />
							{facts.map((fact) => (
								<LiveFacts key={fact} fact={fact} />
							))}
						</div>
					)}
				</form.Subscribe>
			) : (
				<form.Field name="content">
					{(field) => (
						<Field>
							<FieldLabel>Innhold</FieldLabel>
							<div className="min-h-96 overflow-hidden rounded-lg border">
								<EditorMenu editor={editor} />
								<EditorContent editor={editor} />
							</div>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
			)}
			<form.Field name="facts">
				{(field) => (
					<fieldset className="rounded-lg border p-5">
						<legend className="px-2 font-medium text-sm">Fakta som oppdateres fra systemet</legend>
						<p className="mb-3 text-muted-foreground text-sm">
							Velg relevante faktafelter. Unngå å kopiere prisene og tidsfristene inn i teksten.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							{WIKI_FACT_KEYS.map((fact) => (
								<label key={fact} className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={field.state.value.includes(fact)}
										onChange={(event) =>
											field.handleChange(
												event.target.checked
													? [...field.state.value, fact]
													: field.state.value.filter((key) => key !== fact),
											)
										}
									/>
									{WIKI_FACTS[fact]}
								</label>
							))}
						</div>
					</fieldset>
				)}
			</form.Field>
			<form.Field name="policy">
				{(field) => (
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={field.state.value}
							onChange={(event) => field.handleChange(event.target.checked)}
						/>
						<span>
							Dette er en policy som skal gjennomgås årlig. Andre artikler gjennomgås hvert kvartal.
						</span>
					</label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => ({ busy: state.isSubmitting, valid: state.canSubmit })}>
				{({ busy, valid }) => (
					<div className="sticky bottom-0 flex flex-wrap gap-3 border-t bg-background py-4">
						<Button type="submit" variant="outline" disabled={busy || !valid}>
							{busy ? "Lagrer…" : "Lagre utkast"}
						</Button>
						<Button
							type="button"
							disabled={busy || !valid}
							onClick={() => void form.handleSubmit({ publish: true })}
						>
							Publiser
						</Button>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
}
