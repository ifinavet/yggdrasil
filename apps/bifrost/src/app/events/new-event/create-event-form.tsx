"use client";

import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventForm from "@/components/events/event-form/event-form";
import type { EventFormValues } from "@/constants/schemas/event-form-schema";
import type { OrganizerRole } from "@/constants/types";

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
      name: "",
      id: "",
    },
    externalUrl: "",
  };

  const router = useRouter();
  const { mutate } = useMutation({
    mutationFn: useConvexMutation(api.events.create),
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

  const handleSubmit = async (values: EventFormValues, published: boolean) => {
    mutate({
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
        externalUserId: organizer.id,
        role: organizer.role as OrganizerRole,
      })),
      published,
    });
  };

  const onDefaultSubmit = async (values: EventFormValues) => handleSubmit(values, true);

  const onHiddenSubmit = async (values: EventFormValues) => handleSubmit(values, false);

  return (
    <EventForm
      onDefaultSubmitAction={onDefaultSubmit}
      onSecondarySubmitAction={onHiddenSubmit}
      defaultValues={defaultValues}
    />
  );
}
