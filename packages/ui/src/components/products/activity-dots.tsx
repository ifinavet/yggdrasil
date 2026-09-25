import { cn } from "@workspace/ui/lib/utils";

export function ActivityDots({ active, total }: Readonly<{ active: number; total: number }>) {
	const label = `${active} av ${total}`;
	return (
		<span className="inline-flex items-center whitespace-nowrap">
			<span className="inline-flex gap-[3px]" title={`${label} semestre`}>
				{Array.from({ length: total }, (_, index) => index).map((index) => (
					<span
						key={index}
						className={cn(
							"size-2 rounded-[2px]",
							index >= total - active ? "bg-primary" : "bg-border",
						)}
					/>
				))}
			</span>
			<span className="ml-1.5 text-[12.5px] text-muted-foreground tabular-nums">{label}</span>
		</span>
	);
}
