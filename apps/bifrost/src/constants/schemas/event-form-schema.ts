import z from "zod/v4";
import type { OrganizerType } from "../organizer-types";

export const formSchema = z.object({
	title: z.string("").min(1, "Tittel er påkrevd").min(10, "Tittelen må være minst 10 tegn"),
	teaser: z
		.string()
		.min(1, "Vi trenger en liten teaser!")
		.max(250, "Teaser kan være maks 250 tegn"),
	eventDate: z.date("Dato og tid for arrangementet er påkrevd"),
	registrationDate: z.date("Dato og tid for åpning av påmelding er påkrevd"),
	description: z.string().min(1, "Det er veldig viktig med en beskrivelse av arrangementet"),
	food: z.string().min(1, "Skulle vi hatt noe mat kanskje?"),
	location: z.string().min(1, "Hvor skal arrangementet foregå?"),
	ageRestrictions: z.string().min(1, "Hvem alle få lov til å være på arrangementet?"),
	language: z.string().min(1, "Husk å spesifisere språk"),
	participantsLimit: z.number("Deltakergrense er påkrevd"),
	eventType: z.enum(["internal_event", "external_event"]),
	hostingCompany: z.object(
		{ company_name: z.string(), company_id: z.number() },
		"Hvem skal arrangere arrangementet?",
	),
	organizers: z
		.array(
			z.object({
				id: z.string(),
				role: z.custom<keyof typeof OrganizerType>(),
			}),
		)
		.min(1, { message: "Må ha minst en arrangør" }),
	externalUrl: z.string().optional(),
});

export type EventFormValues = z.infer<typeof formSchema>;
