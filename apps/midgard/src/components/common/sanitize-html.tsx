import sanitizeHtml from "sanitize-html";

export default function SafeHtml({
	html,
	className,
}: {
	html: string;
	className?: string;
}) {
	const cleanHtml = sanitizeHtml(html);

	return (
		<div
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The html is sanitized by DOMPurify
			dangerouslySetInnerHTML={{ __html: cleanHtml }}
		/>
	);
}
