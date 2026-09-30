function searchWords(query: string) {
	return query.toLocaleLowerCase("nb").split(/\s+/).filter(Boolean);
}

export function hasSearchWords(query: string) {
	return searchWords(query).length > 0;
}

export function matchesSearch(texts: readonly string[], query: string) {
	const haystack = texts.join(" ").toLocaleLowerCase("nb");
	return searchWords(query).every((word) => haystack.includes(word));
}
