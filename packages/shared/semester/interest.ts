import { z } from "zod";
import { email, text } from "../validation";

/** How long a company name can be; brreg names are well under this. */
export const MAX_COMPANY_NAME_LENGTH = 120;

/**
 * «Gi oss beskjed»: while no semester takes applications, a company leaves its name and email so
 * Navet can tell it when applications open. Navet gets it by email at bedrift@ifinavet.no.
 */
export const companyInterestSchema = z.object({
	companyName: text(MAX_COMPANY_NAME_LENGTH, "Skriv navnet på bedriften."),
	email: z.string().trim().pipe(email("Skriv en gyldig e-postadresse.")),
});

export type CompanyInterest = z.infer<typeof companyInterestSchema>;
