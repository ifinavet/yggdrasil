import z from "zod/v4";

export const formSchema = z.object({
  title: z.string("").min(1, "Tittel er påkrevd").min(10, "Tittelen må være minst 10 tegn"),
  teaser: z
    .string()
    .min(1, "Vi trenger en liten teaser!")
    .min(10, "Teaser må være minst 10 tegn")
    .max(250, "Teaser kan være maks 250 tegn"),
  deadline: z.date("Dato og tid for når stillingsannonsen går ut"),
  description: z.string().min(1, "Det er veldig viktig med en beskrivelse av stillingsannonsen"),
  type: z.enum(["Fulltid", "Deltid", "Internship", "Sommerjobb"]),
  company: z.object(
    { company_name: z.string(), company_id: z.number() },
    "Hvem utlyser stillingen?",
  ),
  contacts: z
    .array(
      z.object({
        contact_id: z.number().optional(),
        name: z.string().min(1, "Navn er påkrevd"),
        email: z.string().optional(),
        phone: z.string().optional(),
      }),
    )
    .min(1, { message: "Må ha minst en kontakt person" }),
  applicationUrl: z.string(),
});

export type JobListingFormValues = z.infer<typeof formSchema>;
