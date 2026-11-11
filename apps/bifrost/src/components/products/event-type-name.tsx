"use client";

import { api } from "@workspace/backend/convex/api";
import { productOfRow } from "@workspace/shared/products";
import { useQuery } from "convex/react";

export function useEventProducts() {
	return useQuery(api.products.queries.listEvent) ?? [];
}

export function EventTypeName({
	row,
}: Readonly<{ row: { productId?: string; eventType?: string } }>) {
	return productOfRow(useEventProducts(), row)?.name;
}
