export function nextUnseenStep<Step extends string>(
	order: readonly Step[],
	available: ReadonlySet<Step>,
	seen: readonly string[],
): Step | null {
	return order.find((step) => available.has(step) && !seen.includes(step)) ?? null;
}
