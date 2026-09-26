import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const orderRateLimiter = new RateLimiter(components.rateLimiter, {
	submitJobListingOrder: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
	submitJobListingOrderGlobal: { kind: "fixed window", rate: 100, period: HOUR },
	resendJobListingOrderConfirmation: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
	jobListingOrderLogoUpload: { kind: "fixed window", rate: 60, period: HOUR },
	jobListingOrderFeedback: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
	jobListingOrderAddressSearch: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 60 },
});
