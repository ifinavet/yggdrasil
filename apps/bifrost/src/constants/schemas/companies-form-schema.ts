import z from "zod/v4";

export const formSchema = z.object({
  name: z.string().min(2, "Venligst oppgi et navn på bedriften"),
  orgNumber: z.string().min(9, "Venligst oppgi et fult organisasjonsnummer"),
  description: z.string().min(10, "Venligst oppgi en beskrivelse på bedriften, mist 10 tegn."),
  image: z.string()
});

export type CompanyFormValues = z.infer<typeof formSchema>;
