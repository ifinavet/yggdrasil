export function withToggled<T>(selected: ReadonlySet<T>, id: T, checked: boolean): ReadonlySet<T> {
	const next = new Set(selected);
	if (checked) next.add(id);
	else next.delete(id);
	return next;
}

export function includesAll<T>(selected: ReadonlySet<T>, ids: readonly T[]) {
	return ids.length > 0 && ids.every((id) => selected.has(id));
}
