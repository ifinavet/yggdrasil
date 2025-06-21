import DOMPurify from "isomorphic-dompurify";

export default function SafeHtml({ html, className }: { html: string; className?: string }) {
	const cleanHtml = DOMPurify.sanitize(html);

	return <div className={className} dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}
