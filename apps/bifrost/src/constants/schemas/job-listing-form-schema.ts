import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import z from "zod/v4";

const formSchema = z.object({
	title: z.string("").min(1, "Tittel er påkrevd"),
	teaser: z
		.string()
		.min(1, "Vi trenger en liten teaser!")
		.max(500, "Teaser kan være maks 500 tegn"),
	deadline: z.date("Dato og tid for når stillingsannonsen går ut"),
	description: z.string().min(1, "Det er veldig viktig med en beskrivelse av stillingsannonsen"),
	type: z.string().min(1, "Velg en ansettelsesform"),
	company: z.object({ name: z.string(), id: z.string() }, "Hvem utlyser stillingen?"),
	contacts: z
		.array(
			z.object({
				name: z.string().min(1, "Navn er påkrevd"),
				email: z.string().optional(),
				phone: z.string().optional(),
			}),
		)
		.min(1, { message: "Må ha minst en kontakt person" }),
	applicationUrl: z.string(),
});

export type JobListingFormValues = z.infer<typeof formSchema>;

export function jobListingFormSchema(latestDeadline?: Date) {
	if (!latestDeadline) return formSchema;
	return formSchema.refine((values) => values.deadline <= latestDeadline, {
		path: ["deadline"],
		message: `Fristen kan ikke være senere enn ${formatOsloDate(latestDeadline.getTime(), DATE_PATTERNS.dateTime)}`,
	});
}
