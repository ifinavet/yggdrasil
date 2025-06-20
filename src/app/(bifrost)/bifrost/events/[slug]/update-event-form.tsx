"use client";

import EventForm from "@/components/bifrost/event-form/event-form";
import getEvent from "@/lib/queries/bifrost/event/getEvent";
import updateEvent from "@/lib/queries/bifrost/event/updateEvent";
import { type EventFormValues } from "@/utils/bifrost/schemas/event-form-schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function UpdateEventForm({
  event_id,
  orgId,
}: {
  event_id: number;
  orgId: string;
}) {
  const {
    isPending,
    error,
    data: event,
  } = useQuery({
    queryKey: ["event", event_id],
    queryFn: () => getEvent(event_id),
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
    mutationFn: ({
      values,
      published,
    }: {
      values: EventFormValues;
      published: boolean;
    }) => updateEvent(event_id, values, published),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", event_id] });

      toast.success("Arrangementet ble oppdatert!", {
        description: `Arrangement oppdatert, ${new Date().toLocaleDateString()}`,
      });
      router.push("/bifrost/events");
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
