"use client";

import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { jobListingOrderUrl } from "@workspace/shared/job-listing-orders";
import type { ComponentProps } from "react";

export default function JobListingOrderLink(props: Readonly<Omit<ComponentProps<"a">, "href">>) {
	return (
		<a {...props} href={jobListingOrderUrl(huginUrl())} target="_blank" rel="noopener noreferrer" />
	);
}
