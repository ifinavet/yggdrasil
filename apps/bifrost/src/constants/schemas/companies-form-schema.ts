import z from "zod/v4";

export const formSchema = z.object({
	company_name: z.string().min(2, "Venligst oppgi et navn på bedriften"),
	org_number: z.string().min(9, "Venligst oppgi et fult organisasjonsnummer"),
	description: z.string().min(10, "Venligst oppgi en beskrivelse på bedriften, mist 10 tegn."),
	company_image: z.object(
		{
			id: z.string(),
			name: z.string(),
		},
		"Venligst velg et bilde",
	),
});

export type CompanyFormValues = z.infer<typeof formSchema>;
