const NORWEGIAN_LETTERS: Record<string, string> = { æ: "ae", ø: "o", å: "a" };

/** Lowercase ASCII for a file name, e.g. "Høsten 2027" becomes "hosten-2027". */
export function asciiFilename(text: string): string {
	return text
		.toLowerCase()
		.replaceAll(/[æøå]/g, (letter) => NORWEGIAN_LETTERS[letter] ?? letter)
		.normalize("NFD")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");
}
