import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/** One of several parts stacked in the same card, with a small heading. */
export function CardSection({
	title,
	aside,
	children,
}: Readonly<{ title: string; aside?: ReactNode; children: ReactNode }>) {
	return (
		<section className="min-w-0 p-4 text-sm leading-[normal]">
			<div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<h2 className="font-semibold text-[13px] text-muted-foreground uppercase tracking-wide">
					{title}
				</h2>
				{aside}
			</div>
			{children}
		</section>
	);
}

/** Label and value pairs; `columns={2}` puts two pairs on a row from the sm breakpoint. */
export function DetailList({
	items,
	columns = 1,
}: Readonly<{ items: [label: string, value: ReactNode][]; columns?: 1 | 2 }>) {
	return (
		<dl
			className={cn(
				"grid gap-x-4 gap-y-2.5 text-[13.5px] tabular-nums",
				columns === 2
					? "grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)_120px_minmax(0,1fr)]"
					: "grid-cols-[90px_minmax(0,1fr)]",
			)}
		>
			{items.map(([label, value]) => (
				<div key={label} className="contents">
					<dt className="text-muted-foreground">{label}</dt>
					<dd className="break-words">{value}</dd>
				</div>
			))}
		</dl>
	);
}
