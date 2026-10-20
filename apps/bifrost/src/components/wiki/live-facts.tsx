"use client";
import { api } from "@workspace/backend/convex/api";
import type { WikiFact } from "@workspace/shared/wiki";
import { useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
export function LiveFacts({ fact }: Readonly<{ fact: WikiFact }>) {
	const data = useQuery(api.wiki.facts.get, { key: fact });
	if (!data)
		return (
			<p role="status" className="py-4 text-muted-foreground text-sm">
				Henter oppdaterte fakta…
			</p>
		);
	return (
		<section className="rounded-lg border bg-muted/30 p-5">
			<p className="mb-2 flex items-center gap-2 font-medium text-muted-foreground text-xs">
				<RefreshCw className="size-3" /> Oppdateres fra Bifrost
			</p>
			<h2 className="font-semibold text-lg">{data.title}</h2>
			<dl className="mt-4 divide-y">
				{data.rows.map((row, index) => (
					<div
						key={`${row.label}-${index}`}
						className="grid gap-1 py-3 text-sm sm:grid-cols-[180px_1fr]"
					>
						<dt className="font-medium">{row.label}</dt>
						<dd className="leading-relaxed">{row.value}</dd>
					</div>
				))}
			</dl>
			<p className="mt-3 text-muted-foreground text-sm leading-relaxed">{data.note}</p>
			<Link
				href={data.href}
				className="mt-3 inline-block font-medium text-sm underline underline-offset-4"
			>
				Åpne i Bifrost
			</Link>
		</section>
	);
}
