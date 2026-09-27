"use client";

import DOMPurify from "isomorphic-dompurify";

export function SafeHtml({ html, className }: Readonly<{ html: string; className?: string }>) {
	return (
		<div
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The html is sanitized by DOMPurify
			dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
		/>
	);
}
