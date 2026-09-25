import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * One card on the application page, with a heading and something on its right. The shared Card
 * with the page's tighter spacing, so every card on the page lines up.
 */
export function Section({
	title,
	aside,
	className,
	children,
}: Readonly<{ title?: string; aside?: ReactNode; className?: string; children: ReactNode }>) {
	return (
		<Card className={cn("min-w-0 gap-3.5 py-4.5 text-sm leading-[normal] shadow-xs", className)}>
			{title && (
				<CardHeader className="items-center gap-y-0 px-5">
					<CardTitle className="text-base">{title}</CardTitle>
					{aside && <CardAction className="self-center">{aside}</CardAction>}
				</CardHeader>
			)}
			<CardContent className="px-5">{children}</CardContent>
		</Card>
	);
}

/** One of several parts stacked in the same card, with a small heading. */
export function CardSection({
	title,
	aside,
	children,
}: Readonly<{ title: string; aside?: ReactNode; children: ReactNode }>) {
	return (
		<section className="min-w-0 px-5 py-4 text-sm leading-[normal]">
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
