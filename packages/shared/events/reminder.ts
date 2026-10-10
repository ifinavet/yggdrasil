import { Marked } from "marked";

export const REMINDER_INFO_MAX_LENGTH = 2000;

const LINK_PROTOCOLS = ["http:", "https:", "mailto:"];

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function safeHref(href: string) {
	try {
		return LINK_PROTOCOLS.includes(new URL(href).protocol) ? href : null;
	} catch {
		return null;
	}
}

const reminderMarkdown = new Marked({
	gfm: true,
	breaks: true,
	renderer: {
		html: ({ text }) => escapeHtml(text),
		image: ({ text }) => escapeHtml(text),
		link({ href, tokens }) {
			const label = this.parser.parseInline(tokens);
			const safe = safeHref(href);
			if (!safe) return label;
			return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
		},
	},
});

export function renderReminderInfo(markdown: string) {
	return reminderMarkdown.parse(markdown, { async: false });
}
