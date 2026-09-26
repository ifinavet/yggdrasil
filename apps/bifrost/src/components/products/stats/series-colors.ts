import type { ProductCategory } from "@workspace/shared/products";

export const SERIES_COLORS = {
	event: "var(--primary)",
	other: "var(--primary)",
	external_event: "var(--series-external)",
	job_listing: "var(--series-jobs)",
} as const satisfies Record<ProductCategory, string>;

export const RETURNING_SERIES = { label: "Tilbakevendende", color: SERIES_COLORS.event };
export const NEW_SERIES = { label: "Nye", color: SERIES_COLORS.external_event };
export const RETURNING_NEW_LEGEND = [RETURNING_SERIES, NEW_SERIES];

const DIMMED_SHARE = "35%";

export function dimmed(color: string) {
	return `color-mix(in oklch, ${color} ${DIMMED_SHARE}, transparent)`;
}
