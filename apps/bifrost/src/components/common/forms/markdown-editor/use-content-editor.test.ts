import { flattenExtensions } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { renderReminderInfo } from "@workspace/shared/events/reminder";
import { describe, expect, it } from "vitest";
import { contentExtensions } from "./use-content-editor";

const manager = new MarkdownManager({
	extensions: flattenExtensions(contentExtensions({ placeholder: "", markdown: true })),
});

const roundtrip = (markdown: string) => manager.serialize(manager.parse(markdown));

describe("markdown content editor", () => {
	it("keeps links, emphasis and lists through an edit", () => {
		const markdown =
			"Last ned [oppgavesettet](https://github.com/ifinavet) på forhånd.\n\n- **Husk** lader\n- *Møt* opp 16:00";
		expect(roundtrip(markdown).trim()).toBe(markdown);
	});

	it("leaves underline out so the output stays plain markdown", () => {
		const names = flattenExtensions(contentExtensions({ placeholder: "", markdown: true })).map(
			({ name }) => name,
		);
		expect(names).toContain("markdown");
		expect(names).not.toContain("underline");
		expect(roundtrip("Ta med ++PC++")).not.toContain("<u>");
	});

	it("produces markdown the reminder renderer turns into links and lists", () => {
		const html = renderReminderInfo(roundtrip("- [Last ned](https://ifinavet.no)\n- **PC**"));
		expect(html).toContain('<a href="https://ifinavet.no" target="_blank"');
		expect(html).toContain("<li><strong>PC</strong></li>");
	});
});
