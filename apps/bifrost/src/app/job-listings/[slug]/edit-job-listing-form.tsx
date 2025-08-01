"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JobListingFormSkeleton from "@/components/job-listings/job-listing-form-skeleton";
import JobListingForm from "@/components/job-listings/job-listings-form/job-listing-form";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { humanReadableDate } from "@/utils/utils";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";

export default function EditJobListingForm({ listingId }: { listingId: Id<"jobListings"> }) {
  const { data: joblisting, isLoading } = useQuery({
    ...convexQuery(api.listings.getById, { id: listingId as Id<"jobListings"> }),
    enabled: !!listingId,
  });

  const { data: company, isLoading: isCompanyLoading } = useQuery({
    ...convexQuery(api.companies.getById, { id: joblisting?.company as Id<"companies"> }),
    enabled: !!joblisting?.company,
  });

  const router = useRouter();

  const updateJobListing = useMutation(api.listings.update);
  const deleteJobListing = useMutation(api.listings.remove);

  const handleUpdate = (values: JobListingFormValues, published: boolean) =>
    updateJobListing({
      id: joblisting!._id as Id<"jobListings">,
      title: values.title,
      teaser: values.teaser,
      description: values.description,
      deadline: values.deadline.getTime(),
      type: values.type,
      company: values.company.id as Id<"companies">,
      contacts: values.contacts.map((contact) => ({
        name: contact.name,
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
      })),
      applicationUrl: values.applicationUrl,
      published,
    }).then(() => {
      toast.success("Stillingsannonse opprettet!", {
        description: `Annonse opprettet ${humanReadableDate(new Date())}`,
      });
      router.push("/job-listings");
    }).catch(error => {
      toast.error("Det har skjedd en feil!");
      console.error(error);
    });

  const handleDelete = (id: Id<"jobListings">) =>
    deleteJobListing({ id }).then(() => {
      toast.success("Stillingsannonse slettet!", {
        description: `Annonse slettet ${humanReadableDate(new Date())}`,
      });
      router.push("/job-listings");
    }).catch(error => {
      toast.error("Det har skjedd en feil!");
      console.error(error);
    });

  if (isLoading || !joblisting || isCompanyLoading || !company) {
    return <JobListingFormSkeleton showDeleteButton={true} />;
  }

  const defaultValues: JobListingFormValues = {
    title: joblisting.title,
    teaser: joblisting.teaser,
    description: joblisting.description,
    deadline: new Date(joblisting.deadline),
    type: joblisting.type as "Fulltid" | "Deltid" | "Internship" | "Sommerjobb",
    company: {
      id: joblisting.company,
      name: company.name,
    },
    contacts: joblisting.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
    })),
    applicationUrl: joblisting.applicationUrl,
  };

  const handlePrimaryFormSubmit = (values: JobListingFormValues) => handleUpdate(values, true);

  const handleSecondaryFormSubmit = (values: JobListingFormValues) => handleUpdate(values, false);

  const handleTertiaryFormSubmit = () => handleDelete(joblisting._id);

  return (
    <JobListingForm
      defaultValues={defaultValues}
      onPrimarySubmitAction={handlePrimaryFormSubmit}
      onSecondarySubmitAction={handleSecondaryFormSubmit}
      onTertiarySubmitAction={handleTertiaryFormSubmit}
    />
  );
}
