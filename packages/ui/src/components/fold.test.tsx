import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Fold } from "./fold";

describe("Fold", () => {
	it("starts collapsed", () => {
		expect(renderToString(<Fold title="Tittel">innhold</Fold>)).not.toContain("<details open");
	});

	it("expands when asked to", () => {
		expect(
			renderToString(
				<Fold title="Tittel" open>
					innhold
				</Fold>,
			),
		).toContain('<details open=""');
	});
});
