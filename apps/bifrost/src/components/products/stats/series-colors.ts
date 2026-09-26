import type { ProductCategory } from "@workspace/shared/products";
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";

export const SERIES_COLORS = {
	event: PRIMARY_SERIES_COLOR,
	other: PRIMARY_SERIES_COLOR,
	external_event: "var(--series-external)",
	job_listing: "var(--series-jobs)",
} as const satisfies Record<ProductCategory, string>;

export const RETURNING_SERIES = { label: "Tilbakevendende", color: SERIES_COLORS.event };
export const NEW_SERIES = { label: "Nye", color: SERIES_COLORS.external_event };
export const RETURNING_NEW_LEGEND = [RETURNING_SERIES, NEW_SERIES];
