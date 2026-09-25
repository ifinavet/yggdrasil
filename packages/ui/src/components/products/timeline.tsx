import type { ReactNode } from "react";

export function Timeline({ children }: Readonly<{ children: ReactNode }>) {
	return <ul className="[&>li:last-child]:border-b-0">{children}</ul>;
}

export function TimelineItem({
	initials,
	diff,
	meta,
	children,
}: Readonly<{ initials: string; diff?: ReactNode; meta: string; children: ReactNode }>) {
	return (
		<li className="grid grid-cols-[28px_1fr] gap-3 border-b py-2.5 text-sm">
			<span className="grid size-7 place-items-center rounded-full bg-muted font-semibold text-[11px]">
				{initials}
			</span>
			<div className="min-w-0">
				<div>{children}</div>
				{diff && (
					<div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] tabular-nums [&_s]:text-muted-foreground">
						{diff}
					</div>
				)}
				<div className="mt-0.5 text-[12.5px] text-muted-foreground">{meta}</div>
			</div>
		</li>
	);
}
