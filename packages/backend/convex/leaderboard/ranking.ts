export function rankBy<T>(entries: readonly T[], countOf: (entry: T) => number) {
	const sorted = entries
		.map((entry) => ({ entry, count: countOf(entry) }))
		.filter(({ count }) => count > 0)
		.sort((a, b) => b.count - a.count);

	return sorted.map(({ entry, count }) => ({
		...entry,
		count,
		rank: sorted.findIndex((other) => other.count === count) + 1,
	}));
}
