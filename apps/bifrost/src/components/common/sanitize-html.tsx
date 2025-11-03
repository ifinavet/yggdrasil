"use client";

import DOMPurify from "isomorphic-dompurify";

export default function SafeHtml({
	html,
	className,
}: Readonly<{
	html: string;
	className?: string;
}>) {
	const cleanHtml = DOMPurify.sanitize(html);

	return (
		<div
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The html is sanitized by DOMPurify
			dangerouslySetInnerHTML={{ __html: cleanHtml }}
		/>
	);
}
