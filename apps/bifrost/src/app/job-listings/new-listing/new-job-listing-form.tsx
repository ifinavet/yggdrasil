"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JobListingForm from "@/components/job-listings/job-listings-form/job-listing-form";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { createJobListing } from "@/lib/queries/job-listings/create";
import { humanReadableDate } from "@/utils/utils";

export default function NewJobListingForm() {
  const defaultValues: JobListingFormValues = {
    title: "",
    teaser: "",
    description: "",
    deadline: new Date(),
    type: "Sommerjobb",
    company: {
      company_id: 0,
      company_name: "",
    },
    contacts: [],
    applicationUrl: "",
  };

  const router = useRouter();

  const { mutate } = useMutation({
    mutationKey: ["createJobListing"],
    mutationFn: ({ values, published }: { values: JobListingFormValues; published: boolean }) =>
      createJobListing(values, published),
    onSuccess: () => {
      toast.success("Stillingsannonse opprettet!", {
        description: `Annonse opprettet ${humanReadableDate(new Date())}`,
      });
      router.push("/job-listings");
    },
    onError: (error) => {
      toast.error("Det har skjedd en feil!")
      console.error(error)
    }
  });

  const handlePrimaryFormSubmit = (values: JobListingFormValues) => {
    mutate({
      values,
      published: true,
    });
  };

  const handleSecondaryFormSubmit = (values: JobListingFormValues) => {
    mutate({
      values,
      published: false,
    });
  };

  return (
    <JobListingForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={handlePrimaryFormSubmit}
      onSecondarySubmitAction={handleSecondaryFormSubmit}
    />
  );
}
