"use client";
import { api } from "@workspace/backend/convex/api";
import type { WikiFact } from "@workspace/shared/wiki";
import { useQuery } from "convex/react";
export function LiveFacts({ fact }: Readonly<{ fact: WikiFact }>) {
	const data = useQuery(api.wiki.facts.get, { key: fact });
	if (!data) return <output className="py-4 text-muted-foreground text-sm">Laster…</output>;
	return (
		<section>
			<h2 className="text-balance font-semibold text-xl leading-7">{data.title}</h2>
			<dl className="mt-4 divide-y">
				{data.rows.map((row, index) => (
					<div
						key={`${row.label}-${index}`}
						className="grid @lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-x-6 gap-y-1 py-3 text-base leading-relaxed"
					>
						<dt className="font-medium">{row.label}</dt>
						<dd className="tabular-nums">{row.value}</dd>
					</div>
				))}
			</dl>
			{data.note && (
				<p className="mt-3 text-muted-foreground text-sm leading-relaxed">{data.note}</p>
			)}
		</section>
	);
}
