import { ConvexError } from "convex/values";
import { notFound } from "next/navigation";

export function notFoundOnConvexError(error: unknown): never {
	if (error instanceof ConvexError) notFound();
	throw error;
}
