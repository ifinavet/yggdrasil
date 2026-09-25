import { ConvexError } from "convex/values";

/** The backend's Norwegian message from a ConvexError, or the fallback for anything else. */
export function convexErrorMessage(
	error: unknown,
	fallback = "Noe gikk galt. Prøv igjen.",
): string {
	return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}

/**
 * Whether a query failed because the id it was given is malformed, or the document is gone. Other
 * failures, like a lost connection or missing rights, are real errors and should not become a 404.
 */
export function isMissingDocumentError(error: unknown): boolean {
	if (error instanceof ConvexError) {
		return typeof error.data === "string" && /(ble ikke funnet|finnes ikke)\.$/.test(error.data);
	}
	return error instanceof Error && error.message.includes("ArgumentValidationError");
}
