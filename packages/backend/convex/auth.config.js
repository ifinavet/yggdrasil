import { DEV_AUTH_AUDIENCE, DEV_AUTH_ISSUER } from "@workspace/shared/constants";

function providers() {
	const clerkDomain = process.env.CLERK_FRONTEND_API_URL;
	if (clerkDomain) {
		return [{ domain: clerkDomain, applicationID: "convex" }];
	}

	const devAuthJwks = process.env.DEV_AUTH_JWKS;
	if (devAuthJwks) {
		return [
			{
				type: "customJwt",
				applicationID: DEV_AUTH_AUDIENCE,
				issuer: DEV_AUTH_ISSUER,
				jwks: devAuthJwks,
				algorithm: "RS256",
			},
		];
	}

	throw new Error(
		"No auth provider is configured. Set CLERK_FRONTEND_API_URL on this deployment, or run `pnpm setup:local` for a local one.",
	);
}

export default { providers: providers() };
