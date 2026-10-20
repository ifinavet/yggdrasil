"use client";

import { api } from "@workspace/backend/convex/api";
import { WIKI_CATEGORIES, WIKI_CATEGORY_KEYS } from "@workspace/shared/wiki";
import { Button } from "@workspace/ui/components/button";
import { SearchField } from "@workspace/ui/components/search-field";
import { useMutation, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WikiLoading } from "./shared";

export function WikiHome() {
	const initialize = useMutation(api.wiki.migration.initialize);
	const [error, setError] = useState<Error>();
	useEffect(() => {
		initialize({}).catch(setError);
	}, [initialize]);
	const params = useSearchParams();
	const [term, setTerm] = useState(params.get("q") ?? "");
	const [query, setQuery] = useState(term);
	useEffect(() => {
		const timer = setTimeout(() => setQuery(term), 200);
		return () => clearTimeout(timer);
	}, [term]);
	const { results, status, loadMore } = usePaginatedQuery(
		api.wiki.queries.browse,
		{ query },
		{ initialNumItems: 40 },
	);
	if (error) throw error;
	return (
		<div className="@lg:space-y-6 space-y-4">
			<SearchField
				value={term}
				onChange={setTerm}
				placeholder="Søk i håndboken"
				showIcon={false}
				className="h-12 min-w-0 shadow-none [&_input]:text-base"
			/>
			{status === "LoadingFirstPage" && <WikiLoading />}
			{status !== "LoadingFirstPage" && results.length === 0 && (
				<p className="py-8 text-base text-muted-foreground">Ingen artikler funnet.</p>
			)}
			<div className="[overflow-wrap:anywhere]" aria-live="polite">
				{WIKI_CATEGORY_KEYS.map((key) => {
					const articles = results.filter((article) => article.category === key);
					if (!articles.length) return null;
					if (!query.trim()) articles.sort((a, b) => a.title.localeCompare(b.title, "nb"));
					return (
						<section
							key={key}
							aria-labelledby={`wiki-${key}`}
							className="@lg:grid @[44rem]:grid-cols-[11rem_minmax(0,1fr)] @lg:grid-cols-[10rem_minmax(0,1fr)] @[44rem]:gap-x-8 @lg:gap-x-6 border-t @lg:py-6 py-4"
						>
							<h2 id={`wiki-${key}`} className="@lg:py-2.5 py-2 font-semibold text-base leading-6">
								{WIKI_CATEGORIES[key].title}
							</h2>
							<ul className="grid min-w-0 @[44rem]:grid-cols-2 grid-cols-1 gap-x-8">
								{articles.map((article) => (
									<li key={article._id} className="min-w-0">
										<Link
											href={`/wiki/${article.slug}`}
											className="block min-h-11 rounded-sm py-2.5 text-base leading-6 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3"
										>
											{article.title}
										</Link>
									</li>
								))}
							</ul>
						</section>
					);
				})}
			</div>
			{status === "CanLoadMore" && (
				<Button variant="outline" className="min-h-11" onClick={() => loadMore(40)}>
					Vis flere
				</Button>
			)}
		</div>
	);
}
