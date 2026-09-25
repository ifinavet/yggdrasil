import { ConvexError } from "convex/values";

export function convexErrorMessage(error: unknown, fallback: string): string {
	return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}

export function firstError(errors: readonly unknown[]): string | undefined {
	return errors.find((error): error is string => typeof error === "string" && error !== "");
}
