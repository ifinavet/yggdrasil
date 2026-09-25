"use client";

import { featureFlags } from "@workspace/shared/feature-flags";
import type { ReactNode } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { useBrowserOptIn } from "@/hooks/use-browser-opt-in";
import { orderPageCopy } from "@/lib/job-listing-order/copy";

export function OrderGate({ children }: Readonly<{ children: ReactNode }>) {
	const optedIn = useBrowserOptIn("jobListingOrdersPreview");
	if (featureFlags.jobListingOrders.enabled || optedIn) return children;
	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel {...orderPageCopy.notFound} action={null} />
		</div>
	);
}
