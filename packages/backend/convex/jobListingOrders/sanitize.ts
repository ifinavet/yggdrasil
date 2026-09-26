import { FilterXSS } from "xss";

const richTextFilter = new FilterXSS({
	whiteList: {
		p: [],
		br: [],
		strong: [],
		b: [],
		em: [],
		i: [],
		u: [],
		s: [],
		ul: [],
		ol: [],
		li: [],
		h2: [],
		h3: [],
		blockquote: [],
		a: ["href", "target", "rel"],
	},
	stripIgnoreTag: true,
	stripIgnoreTagBody: ["script", "style"],
});

export function sanitizeRichText(html: string): string {
	return richTextFilter.process(html);
}
