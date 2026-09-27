import { formatPercent } from "@workspace/shared/products";
import type { ReactNode } from "react";

export function KpiStrip({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border xl:grid-cols-5">
			{children}
		</div>
	);
}

export function Kpi({
	label,
	value,
	detail,
}: Readonly<{ label: string; value: ReactNode; detail: ReactNode }>) {
	return (
		<div className="bg-card px-[18px] py-4">
			<div className="text-[13px] text-muted-foreground">{label}</div>
			<div className="mt-1 font-semibold text-[26px] tabular-nums tracking-[-0.6px]">{value}</div>
			<div className="mt-1 text-[12.5px] text-muted-foreground tabular-nums">{detail}</div>
		</div>
	);
}

export function Delta({ change, suffix }: Readonly<{ change: number | null; suffix: string }>) {
	if (change === null) return suffix;
	const increased = change >= 0;
	return (
		<>
			<span className={increased ? "font-semibold text-positive" : "font-semibold text-destructive"}>
				{increased ? "+" : "−"}
				{formatPercent(Math.abs(change))}
			</span>{" "}
			{suffix}
		</>
	);
}
