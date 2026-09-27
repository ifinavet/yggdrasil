import { cn } from "@workspace/ui/lib/utils";

export type MiniBar = { label: string; value: number; title: string };

export function MiniBars({ bars }: Readonly<{ bars: readonly MiniBar[] }>) {
	const max = Math.max(0, ...bars.map((bar) => bar.value));
	const columns = { gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` };
	return (
		<div>
			<div className="grid h-[90px] items-end gap-1.5" style={columns}>
				{bars.map((bar, index) => (
					<div
						key={bar.label}
						title={bar.title}
						className={cn(
							"rounded-t-[3px]",
							index === bars.length - 1 ? "bg-series-jobs" : "bg-primary/85",
						)}
						style={{ height: `${max > 0 ? (bar.value / max) * 100 : 0}%` }}
					/>
				))}
			</div>
			<div
				className="mt-1.5 grid gap-1.5 text-center text-[10.5px] text-muted-foreground"
				style={columns}
			>
				{bars.map((bar) => (
					<span key={bar.label}>{bar.label}</span>
				))}
			</div>
		</div>
	);
}
