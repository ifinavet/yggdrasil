/** «Februar» for «februar»: the text with its first letter in upper case. */
export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
