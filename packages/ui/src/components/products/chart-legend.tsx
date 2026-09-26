import { cn } from "@workspace/ui/lib/utils";

const MARKERS = {
	square: { className: "size-2.5 rounded-[3px]", fill: true },
	dashed: { className: "w-3.5 border-t-2 border-dashed", fill: false },
	line: { className: "w-3.5 border-t-[3px]", fill: false },
	dot: { className: "size-2.5 rounded-full", fill: true },
	ring: { className: "size-2.5 rounded-full border-2", fill: false },
} as const;

export type LegendItem = { label: string; color: string; marker?: keyof typeof MARKERS };

export function ChartLegend({ items }: Readonly<{ items: readonly LegendItem[] }>) {
	return (
		<ul className="flex flex-wrap gap-3.5 font-normal text-[12.5px] text-muted-foreground">
			{items.map((item) => {
				const marker = MARKERS[item.marker ?? "square"];
				return (
					<li key={item.label} className="inline-flex items-center gap-1.5">
						<span
							aria-hidden
							className={cn("inline-block", marker.className)}
							style={marker.fill ? { background: item.color } : { borderColor: item.color }}
						/>
						{item.label}
					</li>
				);
			})}
		</ul>
	);
}
