"use client";

import type { ReactNode } from "react";
import { useProductsEnabled } from "./use-products-enabled";

export function ProductsGate({ children }: Readonly<{ children: ReactNode }>) {
	return useProductsEnabled() ? children : null;
}
