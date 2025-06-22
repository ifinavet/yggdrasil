import z from "zod/v4";

export const resourceSchema = z.object({
  title: z.string().min(2, "Gi ressursen et bra navn").max(80, "Navnet er for langt, maks 80 tegn"),
  content: z.string().min(1, "Skulle vi kanskje hatt noe innhold?"),
  excerpt: z.string().min(10, "Lag en kort beskrivelse av ressursen").max(200, "Beskrivelsen kan kan være maks 200 tegn."),
  tag: z.optional(z.string()),
});

export type ResourceFormValues = z.infer<typeof resourceSchema>;
