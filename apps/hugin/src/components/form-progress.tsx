/** The sticky «3 av 12 besvart» bar at the top of a Hugin form. */
export function FormProgress({ answered, total }: Readonly<{ answered: number; total: number }>) {
	return (
		<div className="sticky top-0 z-4 flex items-center gap-2.5 bg-background py-3">
			<span className="whitespace-nowrap font-semibold text-[12.5px] text-muted-foreground tabular-nums">
				{answered} av {total} besvart
			</span>
			<span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
				<span
					className="block h-full rounded-full bg-primary transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
					style={{ width: `${total === 0 ? 0 : (answered / total) * 100}%` }}
				/>
			</span>
		</div>
	);
}
