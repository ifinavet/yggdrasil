import { searchSnippet } from "@workspace/shared/wiki";
import { describe, expect, it } from "vitest";
import { articleOutline } from "./article-outline";

describe("handbook reading", () => {
	it("links duplicate and formatted headings with unique stable anchors", () => {
		const outline = articleOutline(
			'<h2 id="old">Hei <em>alle</em></h2><p>Tekst</p><h3>Hei alle</h3>',
		);
		expect(outline.headings).toEqual([
			{ id: "avsnitt-1", title: "Hei alle", level: 2 },
			{ id: "avsnitt-2", title: "Hei alle", level: 3 },
		]);
		expect(outline.html).toContain('<h2 id="avsnitt-1">');
		expect(outline.html).not.toContain('id="old"');
	});
	it("shows a bounded excerpt around a body match without rendering markup", () => {
		const text = `${"Først. ".repeat(100)}Fakturering i Fiken. ${"Etter. ".repeat(100)}`;
		const result = searchSnippet(text, "fakturering");
		expect(result).toContain("Fakturering i Fiken");
		expect(result.length).toBeLessThanOrEqual(202);
	});
});
