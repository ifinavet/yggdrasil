export function splitPlanningEmail(text: string) {
	const separator = "\n\nMed vennlig hilsen\n";
	const index = text.indexOf(separator);
	return index < 0
		? { body: text, signature: "" }
		: { body: text.slice(0, index), signature: text.slice(index + 2) };
}
