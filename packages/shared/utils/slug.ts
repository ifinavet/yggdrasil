const LETTER_REPLACEMENTS: Record<string, string> = { æ: "ae", ø: "o", å: "a", ß: "ss" };

export function asciiSlug(name: string, separator = "-") {
	return name
		.toLowerCase()
		.replaceAll(/[æøåß]/g, (letter) => LETTER_REPLACEMENTS[letter] ?? letter)
		.normalize("NFKD")
		.replaceAll(/\p{M}/gu, "")
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		.join(separator);
}
