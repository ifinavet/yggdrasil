export function nameKey(name: string) {
	return name
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("nb")
		.replace(/[^\p{L}\p{N}]/gu, "");
}
