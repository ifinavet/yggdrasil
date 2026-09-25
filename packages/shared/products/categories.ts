export const PRODUCT_CATEGORIES = ["event", "external_event", "job_listing", "other"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const EVENT_PRODUCT_CATEGORIES: readonly ProductCategory[] = ["event", "external_event"];

export function isEventProduct(product: { category: ProductCategory }): boolean {
	return EVENT_PRODUCT_CATEGORIES.includes(product.category);
}

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
	event: "Arrangement",
	external_event: "Eksternt arrangement",
	job_listing: "Stillingsannonse",
	other: "Annet",
};
