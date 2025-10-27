"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventForm from "@/components/events/event-form/event-form";
import type { EventFormValues } from "@/constants/schemas/event-form-schema";
import type { OrganizerRole } from "@/constants/types";

export default function UpdateEventForm({
	preloadedEvent,
}: Readonly<{ preloadedEvent: Preloaded<typeof api.events.getEvent> }>) {
	const event = usePreloadedQuery(preloadedEvent);
	const router = useRouter();
	const updateEventMutation = useMutation(api.events.update);

	const defaultValues: EventFormValues = {
		title: event.title,
		teaser: event.teaser,
		eventDate: new Date(event.eventStart),
		registrationDate: new Date(event.registrationOpens),
		description: event.description,
		food: event.food,
		location: event.location,
		ageRestrictions: event.ageRestriction,
		language: event.language,
		participantsLimit: event.participationLimit,
		organizers: event.organizers.map((organizer) => ({
			userId: organizer.userId,
			role: organizer.role as OrganizerRole,
		})),
		eventType: event.externalUrl ? "external_event" : "internal_event",
		hostingCompany: {
			id: event.hostingCompany,
			name: event.hostingCompanyName,
		},
		externalUrl: event.externalUrl || "",
	};

	const handleSubmit = (values: EventFormValues, published: boolean) => {
		updateEventMutation({
			id: event._id,
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
			externalUrl: values.externalUrl,
			hostingCompany: values.hostingCompany.id as Id<"companies">,
			organizers: values.organizers.map((organizer) => ({
				userId: organizer.userId as Id<"users">,
				role: organizer.role as OrganizerRole,
			})),
			published,
		})
			.then(() => {
				toast.success("Arrangement oppdatert!", {
					description: `Arrangement oppdatert, ${new Date().toLocaleDateString()}`,
				});
				router.push("/events");
			})
			.catch((error) => {
				console.error(error);
				console.error("Noe gikk galt!");
				toast.error("Noe gikk galt!", {
					description: error.message,
				});
			});
	};

	const onDefaultSubmit = (values: EventFormValues) =>
		handleSubmit(values, true);

	const onSubmit = (values: EventFormValues) =>
		handleSubmit(values, event.published);

	const onHideSubmit = (values: EventFormValues) => handleSubmit(values, false);

	return (
		<EventForm
			onDefaultSubmitAction={onDefaultSubmit}
			onSecondarySubmitAction={onSubmit}
			onTertiarySubmitAction={onHideSubmit}
			defaultValues={defaultValues}
		/>
	);
}
