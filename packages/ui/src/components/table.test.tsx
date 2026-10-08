import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TableCell, TableRow } from "./table";

const marker = { label: "Du er medansvarlig", className: "bg-blue-100" };

function cellsOf(withMarker: boolean) {
	const html = renderToString(
		<table>
			<tbody>
				<TableRow marker={withMarker ? marker : null}>
					<TableCell className="pl-4">Dato</TableCell>
					<TableCell>Navn</TableCell>
				</TableRow>
			</tbody>
		</table>,
	);
	return html.match(/<td[\s\S]*?<\/td>/g) ?? [];
}

describe("TableRow marker", () => {
	it("renders inside the first cell, which positions it, so it never spans the table", () => {
		const [first, second, extra] = cellsOf(true);
		expect(extra).toBeUndefined();
		expect(first).toMatch(/^<td[^>]*class="[^"]*\brelative\b[^"]*\bpl-4\b/);
		expect(first).toContain('data-slot="table-row-marker"');
		expect(first).toContain(marker.label);
		expect(first).toContain("Dato");
		expect(second).not.toContain("table-row-marker");
	});

	it("leaves rows without a marker untouched", () => {
		const [first] = cellsOf(false);
		expect(first).not.toContain("table-row-marker");
		expect(first).not.toMatch(/\brelative\b/);
	});
});
