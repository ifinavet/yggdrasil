import { richTextIsEmpty } from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";

describe("richTextIsEmpty", () => {
	it.each([
		"",
		"   ",
		"<p></p>",
		"<p><br></p>",
		"<p>&nbsp;</p>",
		'<ul><li><p class="x"> </p></li></ul>',
	])("treats %j as empty", (html) => {
		expect(richTextIsEmpty(html)).toBe(true);
	});

	it.each(["<p>Hei</p>", "Hei", "<p>&nbsp;a</p>", "<p>a > b</p>", "&lt;"])(
		"treats %j as content",
		(html) => {
			expect(richTextIsEmpty(html)).toBe(false);
		},
	);

	it("handles long runs of unclosed tags in linear time", () => {
		const html = "<".repeat(200_000);
		const started = performance.now();
		expect(richTextIsEmpty(html)).toBe(true);
		expect(performance.now() - started).toBeLessThan(500);
	});
});
