/** Stable ordinal anchors avoid collisions and work with existing HTML resources. */
export function articleOutline(content: string) {
	const headings: { id: string; title: string; level: number }[] = [];
	const html = content.replace(
		/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
		(_match, level: string, title: string) => {
			const id = `avsnitt-${headings.length + 1}`;
			headings.push({
				id,
				title: title
					.replace(/<[^<>]*>/g, "")
					.replaceAll("&amp;", "&")
					.replaceAll("&nbsp;", " "),
				level: Number(level),
			});
			return `<h${level} id="${id}">${title}</h${level}>`;
		},
	);
	return { html, headings };
}
