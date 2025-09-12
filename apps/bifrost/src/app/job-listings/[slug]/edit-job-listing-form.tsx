"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import JobListingFormSkeleton from "@/components/job-listings/job-listing-form-skeleton";
import JobListingForm from "@/components/job-listings/job-listings-form/job-listing-form";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { humanReadableDate } from "@/utils/utils";

export default function EditJobListingForm({ listingId }: Readonly<{ listingId: Id<"jobListings"> }>) {
	const jobListing = useQuery(api.listings.getById, { id: listingId })
	const company = useQuery(api.companies.getById, jobListing ? { id: jobListing.company } : "skip")

	const postHog = usePostHog();

	const router = useRouter();

	const updateJobListing = useMutation(api.listings.update);
	const handleUpdate = (values: JobListingFormValues, published: boolean) =>
		updateJobListing({
			id: listingId,
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
		})
			.then(() => {
				toast.success("Stillingsannonse opprettet!", {
					description: `Annonse opprettet ${humanReadableDate(new Date())}`,
				});
				router.push("/job-listings");
			})
			.catch((error) => {
				toast.error("Det har skjedd en feil!");

				postHog.captureException(error, { site: "bifrost" });
			});

	const deleteJobListing = useMutation(api.listings.remove);
	const handleDelete = (id: Id<"jobListings">) =>
		deleteJobListing({ id })
			.then(() => {
				toast.success("Stillingsannonse slettet!", {
					description: `Annonse slettet ${humanReadableDate(new Date())}`,
				});
				router.push("/job-listings");
			})
			.catch((error) => {
				toast.error("Det har skjedd en feil!");

				postHog.captureException(error, { site: "bifrost" });
			});

	if (!jobListing || !company) {
		return <JobListingFormSkeleton showDeleteButton={true} />;
	}

	const defaultValues: JobListingFormValues = {
		title: jobListing.title,
		teaser: jobListing.teaser,
		description: jobListing.description,
		deadline: new Date(jobListing.deadline),
		type: jobListing.type as "Fulltid" | "Deltid" | "Internship" | "Sommerjobb",
		company: {
			id: jobListing.company,
			name: company.name,
		},
		contacts: jobListing.contacts.map((contact) => ({
			id: contact.id,
			name: contact.name,
			email: contact.email ?? undefined,
			phone: contact.phone ?? undefined,
		})),
		applicationUrl: jobListing.applicationUrl,
	};

	const handlePrimaryFormSubmit = (values: JobListingFormValues) => handleUpdate(values, true);

	const handleSecondaryFormSubmit = (values: JobListingFormValues) => handleUpdate(values, false);

	const handleTertiaryFormSubmit = () => handleDelete(jobListing._id);

	return (
		<JobListingForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={handlePrimaryFormSubmit}
			onSecondarySubmitAction={handleSecondaryFormSubmit}
			onTertiarySubmitAction={handleTertiaryFormSubmit}
		/>
	);
}
