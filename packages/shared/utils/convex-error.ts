import { ConvexError } from "convex/values";

export function convexErrorMessage(
	error: unknown,
	fallback = "Noe gikk galt. Prøv igjen.",
): string {
	return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}
