import { ConvexError } from "convex/values";

export function describeMutationError(error: unknown, fallback: string): string {
	if (error instanceof ConvexError && typeof error.data === "string") return error.data;
	return fallback;
}
