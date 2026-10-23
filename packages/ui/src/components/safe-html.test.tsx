import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeHtml } from "./safe-html";

const sanitizeHtml = (html: string) => renderToString(<SafeHtml html={html} />);

describe("sanitizeHtml", () => {
	it("keeps headings, lists and emphasis", () => {
		const html = "<h2>T</h2><ul><li><strong>a</strong></li></ul><p><em>b</em></p>";
		expect(sanitizeHtml(html)).toContain(html);
	});

	it("keeps an https link and forces rel when it has a target", () => {
		const out = sanitizeHtml('<a href="https://ifinavet.no" target="_blank" rel="x">l</a>');
		expect(out).toContain('href="https://ifinavet.no"');
		expect(out).toContain('target="_blank"');
		expect(out).toContain('rel="noopener noreferrer"');
	});

	it("keeps mailto and tel links", () => {
		expect(sanitizeHtml('<a href="mailto:a@b.no">m</a>')).toContain('href="mailto:a@b.no"');
		expect(sanitizeHtml('<a href="tel:+4712345678">t</a>')).toContain('href="tel:+4712345678"');
	});

	it("strips javascript and ftp links", () => {
		expect(sanitizeHtml('<a href="javascript:alert(1)">j</a>')).not.toContain("javascript");
		expect(sanitizeHtml('<a href="ftp://x.no/f">f</a>')).not.toContain("ftp");
	});

	it("strips scripts, event handlers, iframes, styles, svg and forms", () => {
		const out = sanitizeHtml(
			'<script>x()</script><img src="https://a.no/i.png" onerror="x()"><iframe src="https://e.no"></iframe><style>a{}</style><svg><circle/></svg><form><input></form><p style="color:red" class="c">t</p>',
		);
		expect(out).not.toMatch(/script|onerror|iframe|style|svg|form|input|class/);
		expect(out).toContain('<img src="https://a.no/i.png">');
	});

	it("keeps images with a data uri", () => {
		expect(sanitizeHtml('<img src="data:image/png;base64,AAA" alt="x">')).toContain(
			'src="data:image/png;base64,AAA"',
		);
	});

	it("renders sanitized html on the server", () => {
		const out = renderToString(<SafeHtml html="<h1>Hei</h1><script>x()</script>" className="c" />);
		expect(out).toContain("<h1>Hei</h1>");
		expect(out).not.toContain("script");
	});
});
