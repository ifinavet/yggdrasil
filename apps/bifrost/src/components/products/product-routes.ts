import type { Id } from "@workspace/backend/convex/dataModel";

export const PRODUCT_ROUTES = {
	list: "/products",
	new: "/products/new",
	tag: "/products/tag",
	detail: (productId: Id<"products">) => `/products/${productId}`,
} as const;
