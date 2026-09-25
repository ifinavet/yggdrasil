import type { Id } from "@workspace/backend/convex/dataModel";
import type { OrganizerRole } from "@workspace/shared/constants";
import type { EventFormValues } from "@/constants/schemas/event-form-schema";

export function toEventMutationArgs(values: EventFormValues, published: boolean) {
	return {
		title: values.title,
		teaser: values.teaser,
		description: values.description,
		eventStart: values.eventDate.getTime(),
		registrationOpens: values.registrationDate.getTime(),
		participationLimit: values.participantsLimit,
		location: values.location,
		food: values.food,
		language: values.language,
		ageRestriction: values.ageRestrictions,
		externalEvent: values.externalEvent,
		externalUrl: values.externalUrl,
		productId: values.productId as Id<"products"> | undefined,
		hostingCompany: values.hostingCompany.id as Id<"companies">,
		organizers: values.organizers.map((organizer) => ({
			userId: organizer.userId as Id<"users">,
			role: organizer.role as OrganizerRole,
		})),
		published,
	};
}
