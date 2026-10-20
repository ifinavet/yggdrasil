"use client";

import { api } from "@workspace/backend/convex/api";
import { WIKI_CATEGORIES, WIKI_CATEGORY_KEYS, type WikiCategory } from "@workspace/shared/wiki";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ArrowUpRight, Bookmark, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WikiBookmarks } from "./bookmarks";
import { ArticleLink, errorMessage, WikiLoading } from "./shared";

export function WikiHome() {
	const params = useSearchParams();
	const initialCategory = params.get("category") as WikiCategory | null;
	const [category, setCategory] = useState<WikiCategory | undefined>(
		initialCategory && WIKI_CATEGORY_KEYS.includes(initialCategory) ? initialCategory : undefined,
	);
	const [term, setTerm] = useState(params.get("q") ?? "");
	const [query, setQuery] = useState(term);
	const [initializing, setInitializing] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setQuery(term), 200);
		return () => clearTimeout(timer);
	}, [term]);
	const home = useQuery(api.wiki.queries.home);
	const initialize = useMutation(api.wiki.migration.initialize);
	const { results, status, loadMore } = usePaginatedQuery(
		api.wiki.queries.browse,
		{ query, category },
		{ initialNumItems: 15 },
	);
	const sectionTitle = category ? WIKI_CATEGORIES[category].title : "Sist oppdatert";
	if (params.get("saved") === "1") return <WikiBookmarks />;
	return (
		<>
			<section className="rounded-xl bg-primary px-6 py-9 text-primary-foreground sm:px-10">
				<p className="font-medium text-sm opacity-80">Rutinene våre, samlet</p>
				<h1 className="mt-2 max-w-2xl font-semibold text-3xl tracking-tight sm:text-4xl">
					Hva skal du gjøre?
				</h1>
				<p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-90">
					Finn neste steg, se hva Bifrost gjør automatisk og få hjelp når noe stopper opp.
				</p>
				<label htmlFor="wiki-search" className="sr-only">
					Søk i håndboken
				</label>
				<div className="relative mt-6 max-w-2xl">
					<Search className="absolute top-3.5 left-4 size-5 text-muted-foreground" />
					<Input
						maxLength={200}
						id="wiki-search"
						type="search"
						value={term}
						onChange={(event) => setTerm(event.target.value)}
						placeholder="Søk etter bedpres, fakturering, prikker, IAM…"
						className="h-12 rounded-lg border-0 bg-background pl-12 text-foreground shadow-none"
					/>
				</div>
			</section>
			{home && !home.initialized && (
				<section className="rounded-lg border p-5">
					<h2 className="font-semibold">Gjør håndboken klar</h2>
					<p className="my-2 max-w-3xl text-muted-foreground text-sm">
						Importer eksisterende ressurser med historikken intakt og legg til de nye rutinene. Den
						gamle bedpress-guiden får en oppdatert versjon. Retningslinjene beholder teksten sin.
					</p>
					<Button
						disabled={initializing}
						onClick={async () => {
							setInitializing(true);
							try {
								await initialize({});
								toast.success("Håndboken klargjøres. Importen kan fortsette i bakgrunnen.");
							} catch (error) {
								toast.error(errorMessage(error));
							} finally {
								setInitializing(false);
							}
						}}
					>
						{initializing ? "Importerer…" : "Klargjør håndboken"}
					</Button>
				</section>
			)}
			{!term && !category && (
				<section aria-label="Vanlige oppgaver" className="grid gap-3 sm:grid-cols-3">
					{[
						["holde-bedpress", "Jeg skal holde bedpress"],
						["fakturering", "Jeg skal fakturere"],
						["medlemskontoer", "Jeg skal følge opp et medlem"],
					].map(([slug, title]) => (
						<Link
							key={slug}
							href={`/wiki/${slug}`}
							className="flex items-center justify-between gap-3 rounded-lg border px-5 py-4 font-medium text-sm hover:bg-muted"
						>
							{title}
							<ArrowUpRight className="size-4 shrink-0" />
						</Link>
					))}
				</section>
			)}
			<div className="grid items-start gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
				<aside className="hidden lg:sticky lg:top-4 lg:block">
					<h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Utforsk etter oppgave
					</h2>
					<nav aria-label="Håndbokkategorier" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
						<button
							type="button"
							aria-pressed={!category}
							onClick={() => setCategory(undefined)}
							className={`rounded-lg px-3 py-3 text-left text-sm ${!category ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
						>
							Alle artikler
						</button>
						{WIKI_CATEGORY_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								aria-pressed={category === key}
								onClick={() => setCategory(key)}
								className={`rounded-lg px-3 py-3 text-left text-sm ${category === key ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
							>
								<span>{WIKI_CATEGORIES[key].title}</span>
								<span className="mt-1 block font-normal text-muted-foreground text-xs leading-relaxed">
									{WIKI_CATEGORIES[key].description}
								</span>
							</button>
						))}
					</nav>
				</aside>
				<div className="min-w-0 space-y-8">
					<label className="block space-y-2 text-sm lg:hidden">
						<span>Kategori</span>
						<select
							aria-label="Håndbokkategori"
							value={category ?? ""}
							onChange={(event) =>
								setCategory(event.target.value ? (event.target.value as WikiCategory) : undefined)
							}
							className="h-11 w-full rounded-lg border bg-background px-3"
						>
							<option value="">Alle artikler</option>
							{WIKI_CATEGORY_KEYS.map((key) => (
								<option key={key} value={key}>
									{WIKI_CATEGORIES[key].title}
								</option>
							))}
						</select>
					</label>
					{!term && !category && home && home.bookmarks.length > 0 && (
						<section>
							<h2 className="mb-3 flex items-center gap-2 font-semibold">
								<Bookmark className="size-4" /> Dine bokmerker
								<Link href="/wiki?saved=1" className="ml-auto font-normal text-sm underline">
									Vis alle
								</Link>
							</h2>
							<div className="grid gap-3 sm:grid-cols-2">
								{home.bookmarks.map((article) => (
									<ArticleLink key={article._id} article={article} />
								))}
							</div>
						</section>
					)}
					{!term && !category && home && home.recommended.length > 0 && (
						<section>
							<h2 className="mb-3 font-semibold">Anbefalt lesing</h2>
							<div className="flex flex-wrap gap-2">
								{home.recommended.map((article) => (
									<Button
										key={article._id}
										variant="outline"
										className="h-auto max-w-full whitespace-normal py-2 text-left"
										asChild
									>
										<Link href={`/wiki/${article.slug}`}>{article.title}</Link>
									</Button>
								))}
							</div>
						</section>
					)}
					<section aria-live="polite" aria-busy={status === "LoadingFirstPage"}>
						<h2 className="mb-4 font-semibold text-xl">
							{query ? `Søkeresultater for «${query}»` : sectionTitle}
						</h2>
						{status === "LoadingFirstPage" && <WikiLoading />}
						{status !== "LoadingFirstPage" &&
							(results.length ? (
								<div className="grid gap-3 xl:grid-cols-2">
									{results.map((article) => (
										<ArticleLink key={article._id} article={article} />
									))}
								</div>
							) : (
								<div className="rounded-lg border border-dashed p-8">
									<h3 className="font-medium">Ingen artikler funnet</h3>
									<p className="mt-2 text-muted-foreground text-sm">
										Prøv et kortere ord, et annet søkeord eller en annen kategori.
									</p>
								</div>
							))}
						{status !== "Exhausted" && status !== "LoadingFirstPage" && (
							<Button
								className="mt-4"
								variant="outline"
								disabled={status === "LoadingMore"}
								onClick={() => loadMore(15)}
							>
								{status === "LoadingMore" ? "Laster…" : "Vis flere artikler"}
							</Button>
						)}
					</section>
				</div>
			</div>
		</>
	);
}
