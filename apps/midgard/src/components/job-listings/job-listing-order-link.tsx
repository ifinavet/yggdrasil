"use client";

import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { jobListingOrderUrl } from "@workspace/shared/job-listing-orders";
import { useFeatureEnabled } from "@workspace/ui/hooks/use-feature-enabled";
import type { ComponentProps } from "react";

export default function JobListingOrderLink(props: Readonly<Omit<ComponentProps<"a">, "href">>) {
	const ordersEnabled = useFeatureEnabled("jobListingOrders");
	return (
		<a
			{...props}
			href={jobListingOrderUrl(huginUrl(), ordersEnabled)}
			target="_blank"
			rel="noopener noreferrer"
		/>
	);
}
