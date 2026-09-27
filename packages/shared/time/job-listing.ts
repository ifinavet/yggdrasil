import { TZDate } from "@date-fns/tz";
import { addMonths } from "date-fns";
import { OSLO_TIME_ZONE } from "./constants";

export const JOB_LISTING_MAX_ACTIVE_MONTHS = 6;

export function jobListingLatestDeadline(publishedAt: number): number {
	return addMonths(
		new TZDate(publishedAt, OSLO_TIME_ZONE),
		JOB_LISTING_MAX_ACTIVE_MONTHS,
	).getTime();
}

export function jobListingPublishedAt(listing: {
	published: boolean;
	publishedAt?: number;
	_creationTime: number;
}): number | undefined {
	return listing.publishedAt ?? (listing.published ? listing._creationTime : undefined);
}
