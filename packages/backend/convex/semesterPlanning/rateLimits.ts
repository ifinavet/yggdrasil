import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Limits for the public Hugin form and brreg search, which need no login.
 * Per-company limits stop one company from flooding the plan; the global limits cap abuse and
 * keep us polite towards brreg.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
	brregSearch: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 60 },
	submitApplication: { kind: "token bucket", rate: 5, period: HOUR, capacity: 5 },
	submitApplicationGlobal: { kind: "fixed window", rate: 200, period: HOUR },
});
