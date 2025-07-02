import DOMPurify from "isomorphic-dompurify";

export default function SafeHtml({ html, className }: { html: string; className?: string }) {
  const cleanHtml = DOMPurify.sanitize(html);


  // biome-ignore lint: The html is sanitized by DOMPurify
  return <div className={className} dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}
