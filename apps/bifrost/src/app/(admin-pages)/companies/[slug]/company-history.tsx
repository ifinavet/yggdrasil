"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";

const dateTime = new Intl.DateTimeFormat("nb-NO", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Europe/Oslo",
});

export function CompanyHistory({ companyId }: Readonly<{ companyId: Id<"companies"> }>) {
	const history = useQuery(api.companies.history.getHistory, { companyId });
	let body: ReactNode;

	if (history === undefined) {
		body = (
			<div className="space-y-3 rounded-lg border bg-card p-4">
				<Skeleton className="h-5 w-2/3" />
				<Skeleton className="h-5 w-1/2" />
				<Skeleton className="h-5 w-3/5" />
			</div>
		);
	} else if (history.length === 0) {
		body = (
			<p className="rounded-lg border bg-card p-4 text-muted-foreground">
				Ingen historikk er registrert ennå.
			</p>
		);
	} else {
		body = (
			<ol className="divide-y rounded-lg border bg-card">
				{history.map((item) => {
					const content = (
						<div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
							<div>
								<p className="font-medium">{item.label}</p>
								{item.detail && <p className="text-muted-foreground text-sm">{item.detail}</p>}
							</div>
							<time
								dateTime={new Date(item.at).toISOString()}
								className="shrink-0 text-muted-foreground text-sm tabular-nums"
							>
								{item.dateLabel ? `${item.dateLabel} · ` : ""}
								{dateTime.format(item.at)}
							</time>
						</div>
					);
					return (
						<li key={item.id} className="px-4">
							{item.href ? (
								<Link href={item.href} className="block hover:text-primary">
									{content}
								</Link>
							) : (
								content
							)}
						</li>
					);
				})}
			</ol>
		);
	}

	return (
		<section aria-labelledby="company-history-heading" className="mt-8">
			<h2 id="company-history-heading" className="mb-3 font-semibold text-xl">
				Historikk
			</h2>
			<p className="mb-3 text-muted-foreground text-sm">Viser inntil 200 registrerte hendelser.</p>
			{body}
		</section>
	);
}
