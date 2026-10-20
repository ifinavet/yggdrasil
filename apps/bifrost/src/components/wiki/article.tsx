"use client";

import { api } from "@workspace/backend/convex/api";
import { WIKI_CATEGORIES, wikiReviewReasons } from "@workspace/shared/wiki";
import { Button } from "@workspace/ui/components/button";
import { SafeHtml } from "@workspace/ui/components/safe-html";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Bookmark, Check, Flag, History, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArticleDialog } from "./article-dialog";
import { articleOutline } from "./article-outline";
import { LiveFacts } from "./live-facts";
import { ArticleLink, errorMessage, WikiLoading, wikiDate } from "./shared";

type WikiData = NonNullable<FunctionReturnType<typeof api.wiki.queries.get>>;

export function WikiArticlePage({ slug }: Readonly<{ slug: string }>) {
	const data = useQuery(api.wiki.queries.get, { slug });
	const bookmark = useMutation(api.wiki.mutations.bookmark);
	const check = useMutation(api.wiki.mutations.check);
	const [dialog, setDialog] = useState<"history" | "report" | "retire" | null>(null);
	const [busy, setBusy] = useState(false);
	if (data === undefined) return <WikiLoading />;
	if (data === null)
		return (
			<section className="py-12">
				<h1 className="font-semibold text-2xl">Artikkelen ble ikke funnet</h1>
				<Link href="/wiki" className="mt-4 inline-block underline">
					Til håndboken
				</Link>
			</section>
		);
	const reasons = wikiReviewReasons(data, data.source.hash, Date.now());
	const run = async (action: () => Promise<unknown>, success: string) => {
		setBusy(true);
		try {
			await action();
			toast.success(success);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const active = data.wikiStatus === "published";
	return (
		<>
			<nav aria-label="Brødsmuler" className="flex flex-wrap gap-3 text-muted-foreground text-sm">
				<Link href="/wiki" className="underline-offset-4 hover:underline">
					Håndbok
				</Link>
				<span aria-hidden="true">/</span>
				<Link
					href={`/wiki?category=${data.article.category}`}
					className="underline-offset-4 hover:underline"
				>
					{WIKI_CATEGORIES[data.article.category].title}
				</Link>
			</nav>
			<ArticleHeading data={data} />
			<div className="flex flex-wrap gap-2 border-y py-3">
				<Button
					variant="outline"
					size="sm"
					disabled={busy}
					aria-pressed={data.bookmarked}
					onClick={() =>
						void run(
							() => bookmark({ resourceId: data._id, saved: !data.bookmarked }),
							data.bookmarked ? "Bokmerket er fjernet" : "Artikkelen er lagret",
						)
					}
				>
					<Bookmark className={data.bookmarked ? "fill-current" : ""} />
					{data.bookmarked ? "Lagret" : "Lagre bokmerke"}
				</Button>
				{data.wikiStatus !== "retired" && (
					<Button variant="outline" size="sm" asChild>
						<Link href={`/wiki/${slug}/edit`}>
							<Pencil />
							Rediger{data.hasDraft ? " utkast" : ""}
						</Link>
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={() => setDialog("history")}>
					<History />
					Historikk
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						setDialog("report");
					}}
				>
					<Flag />
					Meld fra om feil
				</Button>
				{active && (
					<Button
						variant="ghost"
						size="sm"
						disabled={busy}
						onClick={() =>
							void run(
								() =>
									check({
										resourceId: data._id,
										expectedVersion: data.editVersion ?? 0,
										sourceVersion: data.source.hash,
									}),
								"Artikkelen er markert som kontrollert",
							)
						}
					>
						<Check />
						Marker som kontrollert
					</Button>
				)}
			</div>
			{reasons.length > 0 && active && (
				<p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
					Trenger gjennomgang: {reasons.join(", ")}. Faktafeltene nedenfor hentes fra systemet, men
					fremgangsmåten må kontrolleres av en person.
				</p>
			)}
			{!active && (
				<section className="rounded-lg border p-5">
					<h2 className="font-semibold">
						{data.wikiStatus === "retired"
							? "Denne artikkelen er tatt ut av bruk"
							: "Denne artikkelen er et utkast"}
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						{data.retirementNote ??
							"Publiser artikkelen når innholdet er klart. Den vises ikke i vanlig søk."}
					</p>
					{data.replacementSlug && (
						<Button asChild className="mt-3">
							<Link href={`/wiki/${data.replacementSlug}`}>Gå til den oppdaterte rutinen</Link>
						</Button>
					)}
				</section>
			)}
			{active && <ArticleContent data={data} />}
			{data.wikiStatus !== "retired" && (
				<div className="border-t pt-5">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setDialog("retire");
						}}
					>
						Ta artikkelen ut av bruk
					</Button>
				</div>
			)}
			{dialog && (
				<ArticleDialog
					dialog={dialog}
					resourceId={data._id}
					editVersion={data.editVersion ?? 0}
					slug={slug}
					onClose={() => setDialog(null)}
				/>
			)}
		</>
	);
}

function ArticleHeading({ data }: Readonly<{ data: WikiData }>) {
	const checkedBy = data.checkedByName ? ` av ${data.checkedByName}` : "";
	const checkedLabel = data.lastCheckedAt
		? `Kontrollert ${wikiDate(data.lastCheckedAt)}${checkedBy}`
		: "Ikke kontrollert ennå";
	return (
		<header className="max-w-4xl">
			<h1 className="font-semibold text-3xl leading-tight tracking-tight sm:text-4xl">
				{data.title}
			</h1>
			<p className="mt-4 text-lg text-muted-foreground leading-relaxed">{data.excerpt}</p>
			<div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground text-xs">
				<span>Ansvarlig: {data.article.owner}</span>
				<span>
					Oppdatert {wikiDate(data.updatedAt)}
					{data.updatedByName ? ` av ${data.updatedByName}` : ""}
				</span>
				<span>{checkedLabel}</span>
			</div>
		</header>
	);
}

function ArticleContent({ data }: Readonly<{ data: WikiData }>) {
	const outline = articleOutline(data.content);
	return (
		<div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
			<div className="min-w-0 space-y-8">
				<SafeHtml
					html={outline.html}
					className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-8 prose-headings:tracking-tight prose-a:underline-offset-4"
				/>
				{data.article.facts.map((fact) => (
					<LiveFacts key={fact} fact={fact} />
				))}
				{data.related.length > 0 && (
					<section>
						<h2 className="mb-4 font-semibold text-xl">Neste steg</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							{data.related.map((article) => (
								<ArticleLink key={article._id} article={article} />
							))}
						</div>
					</section>
				)}
			</div>
			<aside className="hidden lg:sticky lg:top-6 lg:block">
				<nav aria-label="På denne siden">
					<h2 className="mb-3 font-medium text-sm">På denne siden</h2>
					<ul className="space-y-3 border-l pl-4">
						{outline.headings.map((heading) => (
							<li key={heading.id} className={heading.level === 3 ? "pl-3" : ""}>
								<a
									href={`#${heading.id}`}
									className="text-muted-foreground text-sm hover:text-foreground"
								>
									{heading.title}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<p className="mt-6 text-muted-foreground text-xs leading-relaxed">
					Fant du en feil? Meld fra, eller oppdater artikkelen direkte.
				</p>
			</aside>
		</div>
	);
}
