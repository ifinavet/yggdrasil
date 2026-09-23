import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Limits for the public Hugin endpoints (the form and the offer link), the only semester planning
 * functions that need no login.
 * Per-company limits stop one company from flooding the plan; the global limits cap abuse and
 * keep us polite towards brreg and Peppol.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
	brregSearch: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 60 },
	peppolLookup: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 30 },
	submitApplication: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
	submitApplicationGlobal: { kind: "fixed window", rate: 200, period: HOUR },
	offerResponse: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
});
