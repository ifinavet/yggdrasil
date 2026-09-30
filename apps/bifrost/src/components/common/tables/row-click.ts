const INTERACTIVE = "a, button, input, select, textarea, label, [role=combobox], [role=checkbox]";

type ClickTarget = Readonly<{ closest: (selectors: string) => unknown }>;

export function isRowClick<T extends ClickTarget>(
	row: { contains(target: NoInfer<T>): boolean },
	target: T,
) {
	return row.contains(target) && target.closest(INTERACTIVE) === null;
}
