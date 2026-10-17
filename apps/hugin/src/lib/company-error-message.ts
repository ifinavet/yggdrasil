import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants";
import { convexErrorMessage } from "@workspace/shared/utils";

/** What a company sees when something fails that the backend did not explain. */
export const UNEXPECTED_COMPANY_ERROR = `Beklager, noe gikk galt hos oss. Prøv igjen om litt, eller skriv til oss på ${COMPANY_CONTACT_EMAIL}, så hjelper vi dere.`;

/**
 * The Norwegian message from a refused call on the company pages (application, company search,
 * offer), or a general one for anything unexpected.
 */
export function companyErrorMessage(error: unknown): string {
	return convexErrorMessage(error, UNEXPECTED_COMPANY_ERROR);
}
