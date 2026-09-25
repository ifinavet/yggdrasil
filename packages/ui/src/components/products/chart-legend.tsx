import { cn } from "@workspace/ui/lib/utils";

export type LegendItem = { label: string; color: string; dashed?: boolean };

export function ChartLegend({ items }: Readonly<{ items: readonly LegendItem[] }>) {
	return (
		<ul className="flex flex-wrap gap-3.5 font-normal text-[12.5px] text-muted-foreground">
			{items.map((item) => (
				<li key={item.label} className="inline-flex items-center gap-1.5">
					<span
						aria-hidden
						className={cn(
							"inline-block",
							item.dashed ? "w-3.5 border-t-2 border-dashed" : "size-2.5 rounded-[3px]",
						)}
						style={item.dashed ? { borderColor: item.color } : { background: item.color }}
					/>
					{item.label}
				</li>
			))}
		</ul>
	);
}
