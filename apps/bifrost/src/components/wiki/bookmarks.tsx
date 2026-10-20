"use client";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { usePaginatedQuery } from "convex/react";
import { ArticleLink, WikiLoading } from "./shared";
export function WikiBookmarks() {
	const { results, status, loadMore } = usePaginatedQuery(
		api.wiki.queries.bookmarks,
		{},
		{ initialNumItems: 12 },
	);
	return (
		<section>
			<h1 className="mb-5 font-semibold text-3xl">Dine bokmerker</h1>
			{status === "LoadingFirstPage" ? (
				<WikiLoading />
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{results.map((article) => (
						<ArticleLink key={article._id} article={article} />
					))}
				</div>
			)}
			{status === "Exhausted" && !results.length && (
				<p className="text-muted-foreground">
					Åpne en artikkel og velg Lagre bokmerke for å finne den igjen her.
				</p>
			)}
			{status === "CanLoadMore" && (
				<Button className="mt-4" variant="outline" onClick={() => loadMore(12)}>
					Vis flere bokmerker
				</Button>
			)}
		</section>
	);
}
