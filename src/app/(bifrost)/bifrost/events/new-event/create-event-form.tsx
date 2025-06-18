"use client";

import EventForm from "@/components/bifrost/event-form/event-form";
import createEvent from "@/lib/queries/bifrost/createEvent";
import type { EventFormValues } from "@/utils/bifrost/schemas/event-form-schema";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    mutationFn: ({
      values,
      visible,
    }: {
      values: EventFormValues;
      visible: boolean;
    }) => createEvent(values, visible),
    onSuccess: () => {
      toast.success("Arrangementet ble opprettet!", {
        description: `Arrangement opprettet, ${new Date().toLocaleDateString()}`,
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

  const onDefaultSubmit = async (values: EventFormValues) => {
    mutate({ values, visible: true });
  };

  const onHiddenSubmit = async (values: EventFormValues) => {
    mutate({ values, visible: false });
  };

  return (
    <EventForm
      onDefaultSubmitAction={onDefaultSubmit}
      onSecondarySubmitAction={onHiddenSubmit}
      defaultValues={defaultValues}
    />
  );
}
