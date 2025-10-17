import { getToken as getTokenNextJs } from "@convex-dev/better-auth/nextjs";
import { createAuth } from "@workspace/backend/lib/auth";

export const getToken = () => {
	return getTokenNextJs(createAuth);
};
