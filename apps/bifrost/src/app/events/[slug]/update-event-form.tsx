"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import EventForm from "@/components/events/event-form/event-form";
import { getEventById, updateEvent } from "@/lib/queries/events";
import { EventFormValues } from "@/constants/schemas/event-form-schema";

export default function UpdateEventForm({ event_id, orgId }: { event_id: number; orgId: string }) {
  const {
    isPending,
    error,
    data: event,
  } = useQuery({
    queryKey: ["event", event_id],
    queryFn: () => getEventById(event_id),
    enabled: !!orgId,
  });

  if (isPending || !event) {
    return <div>Loading...</div>;
  }

  if (error) {
    toast.error("Failed to load event");
    return <div>Error</div>;
  }

  const defaultValues: EventFormValues = {
    title: event.title,
    teaser: event.teaser || "",
    eventDate: new Date(event.event_start),
    registrationDate: new Date(event.registration_opens),
    description: event.description || "",
    food: event.food || "",
    location: event.location || "",
    ageRestrictions: event.age_restrictions || "",
    language: event.language,
    participantsLimit: event.participants_limit,
    organizers: event.organizers.map((organizer) => ({
      id: organizer.id,
      role: organizer.role,
    })),
    eventType: event.external_url ? "external_event" : "internal_event",
    hostingCompany: event.companies,
    externalUrl: event.external_url || "",
  };

  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({ values, published }: { values: EventFormValues; published: boolean }) =>
      updateEvent(event_id, values, published),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", event_id] });

      toast.success("Arrangementet ble oppdatert!", {
        description: `Arrangement oppdatert, ${new Date().toLocaleDateString()}`,
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

  const onDefaultSubmit = (values: EventFormValues) => {
    mutate({ values, published: true });
  };

  const onSubmit = (values: EventFormValues) => {
    mutate({ values, published: event.published });
  };

  const onHideSubmit = (values: EventFormValues) => {
    mutate({ values, published: false });
  };

  return (
    <EventForm
      onDefaultSubmitAction={onDefaultSubmit}
      onSecondarySubmitAction={onSubmit}
      onTertiarySubmitAction={onHideSubmit}
      defaultValues={defaultValues}
    />
  );
}
