"use client";

import { api } from "@workspace/backend/convex/api";
import { formatOsloToday } from "@workspace/shared/time";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventForm from "@/components/events/event-form/event-form";
import { toEventMutationArgs } from "@/components/events/event-form/to-event-mutation-args";
import type { EventFormValues } from "@/constants/schemas/event-form-schema";

export default function CreateEventForm() {
	const defaultValues: EventFormValues = {
		title: "",
		teaser: "",
		eventDate: new Date(new Date().setHours(16, 0, 0, 0)),
		registrationDate: new Date(new Date().setHours(12, 0, 0, 0)),
		description: "",
		food: "",
		location: "",
		ageRestrictions: "",
		language: "Norsk",
		participantsLimit: 40,
		organizers: [],
		externalEvent: false,
		hostingCompany: {
			name: "",
			id: "",
		},
		externalUrl: "",
		productId: undefined,
	};

	const router = useRouter();
	const createEventMutation = useMutation(api.events.mutations.create);
	const handleSubmit = (values: EventFormValues, published: boolean) =>
		createEventMutation(toEventMutationArgs(values, published))
			.then(() => {
				toast.success("Arrangementet ble opprettet!", {
					description: `Arrangement opprettet, ${formatOsloToday()}`,
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

	const onDefaultSubmit = (values: EventFormValues) => handleSubmit(values, true);

	const onHiddenSubmit = (values: EventFormValues) => handleSubmit(values, false);

	return (
		<EventForm
			onDefaultSubmitAction={onDefaultSubmit}
			onSecondarySubmitAction={onHiddenSubmit}
			defaultValues={defaultValues}
			productRequired
		/>
	);
}
