import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import { ConvexError } from "convex/values";

/** What a company sees when something fails that the backend did not explain. */
export const UNEXPECTED_COMPANY_ERROR = `Noe gikk galt. Prøv igjen, eller skriv til ${COMPANY_CONTACT_EMAIL}.`;

/**
 * The Norwegian message from a refused call on the company pages (application, company search,
 * offer), or a general one for anything unexpected.
 */
export function companyErrorMessage(error: unknown): string {
	if (error instanceof ConvexError && typeof error.data === "string") return error.data;
	return UNEXPECTED_COMPANY_ERROR;
}
