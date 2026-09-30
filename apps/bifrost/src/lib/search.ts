export function normalizedSearch(search: string): string {
	return search.trim().toLocaleLowerCase("nb");
}

export function matchesAny(texts: (string | null | undefined)[], search: string): boolean {
	const needle = normalizedSearch(search);
	if (!needle) return true;
	return texts.some((text) => text?.toLocaleLowerCase("nb").includes(needle));
}

export function searchFolds(search: string): { key: string; open: true | undefined } {
	const needle = normalizedSearch(search);
	return { key: needle, open: needle ? true : undefined };
}
