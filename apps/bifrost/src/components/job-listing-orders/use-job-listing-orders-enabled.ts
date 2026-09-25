"use client";

import { featureFlags } from "@workspace/shared/feature-flags";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";

export function useJobListingOrdersEnabled() {
	const optedIn = useBrowserOptIn("jobListingOrdersPreview");
	return featureFlags.jobListingOrders.enabled || optedIn;
}
