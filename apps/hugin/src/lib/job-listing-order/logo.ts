import { LOGO_CONTENT_TYPES, LOGO_MAX_BYTES } from "@workspace/shared/job-listing-orders";
import { companyCopy } from "./copy";

const allowedTypes: readonly string[] = LOGO_CONTENT_TYPES;

export const LOGO_ACCEPT = LOGO_CONTENT_TYPES.join(",");

export function logoProblem(file: Pick<File, "type" | "size">): string | null {
	if (!allowedTypes.includes(file.type)) return companyCopy.logoWrongType;
	if (file.size > LOGO_MAX_BYTES) return companyCopy.logoTooLarge;
	return null;
}
