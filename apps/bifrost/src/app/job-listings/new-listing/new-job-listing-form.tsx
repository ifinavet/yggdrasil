"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import JobListingForm from "@/components/job-listings/job-listings-form/job-listing-form";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { humanReadableDate } from "@/utils/utils";

export default function NewJobListingForm() {
  const defaultValues: JobListingFormValues = {
    title: "",
    teaser: "",
    description: "",
    deadline: new Date(),
    type: "Sommerjobb",
    company: {
      id: "",
      name: "",
    },
    contacts: [],
    applicationUrl: "",
  };

  const router = useRouter();

  const posthog = usePostHog();

  const createJobListingMutation = useMutation(api.listings.create);
  const handleSubmit = async (values: JobListingFormValues, published: boolean) => {
    createJobListingMutation({
      title: values.title,
      teaser: values.teaser,
      description: values.description,
      deadline: values.deadline.getTime(),
      type: values.type,
      company: values.company.id as Id<"companies">,
      contacts: values.contacts.map((contact) => ({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      })),
      applicationUrl: values.applicationUrl,
      published,
    })
      .then(() => {
        toast.success("Stillingsannonse opprettet!", {
          description: `Annonse opprettet ${humanReadableDate(new Date())}`,
        });
        router.push("/job-listings");
      })
      .catch((error) => {
        toast.error("Det har skjedd en feil!");

        posthog.captureException(error, { site: "bifrost" })
      });
  };

  const handlePrimaryFormSubmit = (values: JobListingFormValues) => {
    handleSubmit(values, true);
  };

  const handleSecondaryFormSubmit = (values: JobListingFormValues) => {
    handleSubmit(values, false);
  };

  return (
    <JobListingForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={handlePrimaryFormSubmit}
      onSecondarySubmitAction={handleSecondaryFormSubmit}
    />
  );
}
