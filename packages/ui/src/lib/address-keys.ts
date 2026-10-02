const CARET_KEYS = new Set(["Home", "End"]);
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown"]);
const VIM_KEYS = new Set(["n", "j", "p", "k"]);

type AddressKey = Readonly<{ key: string; ctrlKey: boolean }>;

export function movesSuggestionHighlight({ key, ctrlKey }: AddressKey) {
	return ARROW_KEYS.has(key) || (ctrlKey && VIM_KEYS.has(key));
}

export function addressKeyTarget(
	event: AddressKey,
	suggestions: Readonly<{ open: boolean; navigated: boolean }>,
): "input" | "suggestions" {
	if (!suggestions.open || CARET_KEYS.has(event.key)) return "input";
	if (event.key === "Enter" && !suggestions.navigated) return "input";
	return "suggestions";
}
