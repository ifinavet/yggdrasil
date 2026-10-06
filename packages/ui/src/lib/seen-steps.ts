export function parseSeenSteps(raw: string | null): readonly string[] {
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
	} catch {
		return [];
	}
}

export function nextUnseenStep<Step extends string>(
	order: readonly Step[],
	available: ReadonlySet<Step>,
	seen: readonly string[],
): Step | null {
	return order.find((step) => available.has(step) && !seen.includes(step)) ?? null;
}
