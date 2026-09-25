/** One choice in a `SearchSelect`. */
export type SearchSelectItem = {
	readonly id: string;
	readonly label: string;
	/** A second, muted line, e.g. an email or an org number. Also searched in a static list. */
	readonly description?: string;
	/** Shown instead of a check mark, and makes the item impossible to pick, e.g. «Slettet». */
	readonly disabledReason?: string;
};

/** The items whose label or description contain every word of the query, in their given order. */
export function filterSearchItems(
	items: readonly SearchSelectItem[],
	query: string,
): readonly SearchSelectItem[] {
	const words = query.toLocaleLowerCase("nb").split(/\s+/).filter(Boolean);
	if (words.length === 0) return items;

	return items.filter((item) => {
		const haystack = [item.label, item.description ?? ""].join(" ").toLocaleLowerCase("nb");
		return words.every((word) => haystack.includes(word));
	});
}

/**
 * Hands out a ticket per request; only the newest ticket is still current. Guards async searches
 * against an older, slower response overwriting the results of a newer query.
 */
export function createLatestGate(): () => () => boolean {
	let latest = 0;
	return () => {
		const ticket = ++latest;
		return () => ticket === latest;
	};
}
