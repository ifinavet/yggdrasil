export const JOB_LISTINGS_GUIDE_STORAGE_KEY = "job-listings-guide-seen";

export const JOB_LISTINGS_GUIDE_STEPS = [
	"orders",
	"search",
	"create",
	"publish",
	"expired",
] as const;

export type JobListingsGuideStep = (typeof JOB_LISTINGS_GUIDE_STEPS)[number];
