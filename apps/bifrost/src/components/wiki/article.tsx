"use client";
import { api } from "@workspace/backend/convex/api";
import { SafeHtml } from "@workspace/ui/components/safe-html";
import { useQuery } from "convex/react";
import Link from "next/link";
import { LiveFacts } from "./live-facts";
import { WikiLoading } from "./shared";

export function WikiArticlePage({ slug }: Readonly<{ slug: string }>) {
	const article = useQuery(api.wiki.queries.get, { slug });
	if (article === undefined) return <WikiLoading />;
	return (
		<div className="@container mx-auto min-w-0 max-w-prose space-y-4 [overflow-wrap:anywhere]">
			<Link
				href="/wiki"
				className="inline-flex min-h-11 items-center rounded-sm text-muted-foreground text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
			>
				Til håndboken
			</Link>
			{article ? (
				<article className="space-y-6">
					<h1 className="text-balance font-semibold text-2xl leading-tight tracking-tight sm:text-3xl">
						{article.title}
					</h1>
					<SafeHtml
						html={article.content}
						className="prose prose-base dark:prose-invert prose-li:my-2 prose-ol:my-4 prose-p:my-4 prose-ul:my-4 prose-h2:mt-8 prose-h2:mb-3 max-w-none prose-headings:text-balance prose-headings:font-semibold prose-h2:text-xl leading-7 prose-h2:leading-7 prose-a:underline-offset-4 [&_li>p]:my-0"
					/>
					{(article.facts ?? []).map((fact) => (
						<LiveFacts key={fact} fact={fact} />
					))}
				</article>
			) : (
				<p>Artikkelen ble ikke funnet.</p>
			)}
		</div>
	);
}
