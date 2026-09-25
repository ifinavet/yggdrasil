import { ConvexError } from "convex/values";

/** The backend's Norwegian message from a ConvexError, or the fallback for anything else. */
export function convexErrorMessage(
	error: unknown,
	fallback = "Noe gikk galt. Prøv igjen.",
): string {
	return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}
