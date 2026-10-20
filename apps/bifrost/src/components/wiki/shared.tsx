"use client";
import { Skeleton } from "@workspace/ui/components/skeleton";
export function WikiLoading() {
	return (
		<section className="space-y-4" aria-label="Laster artikler" aria-busy="true">
			{[1, 2, 3].map((key) => (
				<Skeleton key={key} className="h-5 w-2/3" />
			))}
		</section>
	);
}
