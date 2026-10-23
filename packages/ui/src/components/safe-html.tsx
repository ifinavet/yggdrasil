"use client";

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
	"p",
	"br",
	"hr",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"code",
	"ul",
	"ol",
	"li",
	"a",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"strike",
	"del",
	"ins",
	"sub",
	"sup",
	"span",
	"div",
	"img",
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"th",
	"td",
];

const ALLOWED_ATTR = [
	"href",
	"target",
	"rel",
	"src",
	"srcset",
	"alt",
	"title",
	"width",
	"height",
	"colspan",
	"rowspan",
];

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "A" && node.hasAttribute("target")) {
		node.setAttribute("rel", "noopener noreferrer");
	}
});

export function SafeHtml({ html, className }: Readonly<{ html: string; className?: string }>) {
	return (
		<div
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The html is sanitized by DOMPurify
			dangerouslySetInnerHTML={{
				__html: DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP }),
			}}
		/>
	);
}
