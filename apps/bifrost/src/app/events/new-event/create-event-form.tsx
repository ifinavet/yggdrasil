"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventForm from "@/components/events/event-form/event-form";
import createEvent from "@/lib/queries/event/createEvent";
import type { EventFormValues } from "@/utils/schemas/event-form-schema";

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
		eventType: "internal_event",
		hostingCompany: {
			company_name: "",
			company_id: NaN,
		},
		externalUrl: "",
	};

	const router = useRouter();
	const { mutate } = useMutation({
		mutationFn: ({ values, published }: { values: EventFormValues; published: boolean }) =>
			createEvent(values, published),
		onSuccess: () => {
			toast.success("Arrangementet ble opprettet!", {
				description: `Arrangement opprettet, ${new Date().toLocaleDateString()}`,
			});
			router.push("/events");
		},
		onError: (error) => {
			console.error(error);
			console.error("Noe gikk galt!");
			toast.error("Noe gikk galt!", {
				description: error.message,
			});
		},
	});

	const onDefaultSubmit = async (values: EventFormValues) => {
		mutate({ values, published: true });
	};

	const onHiddenSubmit = async (values: EventFormValues) => {
		mutate({ values, published: false });
	};

	return (
		<EventForm
			onDefaultSubmitAction={onDefaultSubmit}
			onSecondarySubmitAction={onHiddenSubmit}
			defaultValues={defaultValues}
		/>
	);
}
