const BYTE_ORDER_MARK = "\uFEFF";

function cell(value: string | number | boolean | null | undefined): string {
	const text = value === null || value === undefined ? "" : String(value);
	return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Turns rows into CSV that Excel opens with æøå intact: a UTF-8 byte order mark, quoted cells
 * where needed, and CRLF line endings.
 */
export function toCsv(
	rows: readonly (readonly (string | number | boolean | null | undefined)[])[],
): string {
	return BYTE_ORDER_MARK + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
