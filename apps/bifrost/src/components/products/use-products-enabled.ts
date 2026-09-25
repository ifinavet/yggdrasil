"use client";

import { featureFlags } from "@workspace/shared/feature-flags";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";

export function useProductsEnabled() {
	const optedIn = useBrowserOptIn("productsPreview");
	return featureFlags.products.uiEnabled || optedIn;
}
