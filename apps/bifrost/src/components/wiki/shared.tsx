"use client";

import { formatOsloDate } from "@workspace/shared/time";
import { WIKI_CATEGORIES, type WikiCategory } from "@workspace/shared/wiki";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { ConvexError } from "convex/values";
import { ArrowRight, BookOpen, ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";

export function errorMessage(error: unknown) {
	return error instanceof ConvexError
		? String(error.data)
		: "Handlingen kunne ikke fullføres. Prøv igjen.";
}
export const wikiDate = (value: number) => formatOsloDate(value, "d. MMM yyyy");
export function WikiLoading() {
	return (
		<output className="flex items-center gap-3 py-12 text-muted-foreground">
			<Spinner /> Laster håndboken
		</output>
	);
}
export function WikiHeader() {
	return (
		<header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
			<Link href="/wiki" className="flex items-center gap-2 font-semibold">
				<BookOpen className="size-5" /> Navet-håndboken
			</Link>
			<div className="flex gap-2">
				<Button variant="ghost" size="sm" asChild>
					<Link href="/wiki?saved=1">Bokmerker</Link>
				</Button>
				<Button variant="ghost" size="sm" asChild>
					<Link href="/wiki/review">
						<ClipboardCheck className="size-4" /> Oppfølging
					</Link>
				</Button>
				<Button variant="outline" size="sm" asChild>
					<Link href="/wiki/new">
						<Plus className="size-4" /> Ny artikkel
					</Link>
				</Button>
			</div>
		</header>
	);
}
export function ArticleLink({
	article,
}: Readonly<{
	article: {
		slug: string;
		title: string;
		excerpt: string;
		category: WikiCategory;
		updatedAt: number;
		snippet?: string;
	};
}>) {
	return (
		<Link
			href={`/wiki/${article.slug}`}
			className="group flex gap-4 rounded-lg border p-5 transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
		>
			<div className="min-w-0 flex-1">
				<p className="mb-2 text-muted-foreground text-xs">
					{WIKI_CATEGORIES[article.category].title}
				</p>
				<h3 className="font-semibold text-lg group-hover:underline">{article.title}</h3>
				<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
					{article.snippet ?? article.excerpt}
				</p>
				<p className="mt-3 text-muted-foreground text-xs">
					Oppdatert {wikiDate(article.updatedAt)}
				</p>
			</div>
			<ArrowRight className="mt-7 size-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}
