const JOB_LISTINGS_VISIBLE_AT_ONCE = 3;

export function hasJobListingsCarouselControls(listingCount: number) {
	return listingCount > JOB_LISTINGS_VISIBLE_AT_ONCE;
}
