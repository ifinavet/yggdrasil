import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// @ts-nocheck
export const authClient = createAuthClient({
	plugins: [convexClient(), adminClient(), organizationClient()],
});
