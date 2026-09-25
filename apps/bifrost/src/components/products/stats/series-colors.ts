import type { ProductCategory } from "@workspace/shared/products";

export const SERIES_COLORS = {
	event: "var(--primary)",
	other: "var(--primary)",
	external_event: "var(--series-external)",
	job_listing: "var(--series-jobs)",
} as const satisfies Record<ProductCategory, string>;

const DIMMED_SHARE = "35%";

export function dimmed(color: string) {
	return `color-mix(in oklch, ${color} ${DIMMED_SHARE}, transparent)`;
}
