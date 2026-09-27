import type { api } from "@workspace/backend/convex/api";
import { MIDGARD_URL } from "@workspace/shared/constants";
import type { FunctionReturnType } from "convex/server";
import { addDays } from "date-fns";
import { matchesAny } from "@/lib/search";

export type OverviewListing = FunctionReturnType<typeof api.jobListings.queries.getAll>[number];

export type ListingSections = {
	unpublished: OverviewListing[];
	published: OverviewListing[];
	expired: OverviewListing[];
};

const DEADLINE_SOON_DAYS = 7;

export function publicListingUrl(listing: Pick<OverviewListing, "_id">): string {
	return `${MIDGARD_URL}/job-listings/${listing._id}`;
}

export function deadlineIsSoon(listing: Pick<OverviewListing, "deadline">, now: number): boolean {
	return listing.deadline < addDays(now, DEADLINE_SOON_DAYS).getTime();
}

export function matchesSearch(
	listing: Pick<OverviewListing, "title" | "companyName" | "type">,
	search: string,
): boolean {
	return matchesAny([listing.title, listing.companyName, listing.type], search);
}

export function splitIntoSections(
	listings: OverviewListing[],
	now: number,
	search = "",
): ListingSections {
	const matching = listings.filter((listing) => matchesSearch(listing, search));
	const active = matching
		.filter((listing) => listing.deadline >= now)
		.sort((a, b) => a.deadline - b.deadline);

	return {
		unpublished: active.filter((listing) => !listing.published),
		published: active.filter((listing) => listing.published),
		expired: matching
			.filter((listing) => listing.deadline < now)
			.sort((a, b) => b.deadline - a.deadline),
	};
}
