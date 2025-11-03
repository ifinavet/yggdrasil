import sanitizeHtml from "sanitize-html";

export default function SafeHtml({
	html,
	className,
}: Readonly<{
	html: string;
	className?: string;
}>) {
	const cleanHtml = sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags
			.filter((t) => t !== "iframe")
			.concat(["img"]),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ["src", "alt", "title", "width", "height", "srcset"],
		},
		allowedSchemes: ["http", "https"],
		allowedSchemesByTag: {
			img: ["http", "https", "data"],
		},
		// Explicitly disallow iframe-related hosts/domains
		allowedIframeHostnames: [],
	});

	return (
		<div
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The html is sanitized by sanitize-html, configured to mirror the previous DOMPurify policy
			dangerouslySetInnerHTML={{ __html: cleanHtml }}
		/>
	);
}
