"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JobListingFormSkeleton from "@/components/job-listings/job-listing-form-skeleton";
import JobListingForm from "@/components/job-listings/job-listings-form/job-listing-form";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { getCompanyById } from "@/lib/queries/companies";
import deleteJobListing from "@/lib/queries/job-listings/delete";
import getJobListingById from "@/lib/queries/job-listings/getById";
import { updateJobListing } from "@/lib/queries/job-listings/update";
import { humanReadableDate } from "@/utils/utils";

export default function EditJobListingForm({ listing_id }: { listing_id: number }) {
	const { data: joblisting, isLoading } = useQuery({
		queryKey: ["joblisting", listing_id],
		queryFn: () => getJobListingById(listing_id),
		enabled: !!listing_id,
	});

	const { data: company, isLoading: isCompanyLoading } = useQuery({
		queryKey: ["company", joblisting?.company_id],
		queryFn: () => getCompanyById(joblisting!.company_id),
		enabled: !!joblisting?.company_id,
	});

	const router = useRouter();

	const { mutate } = useMutation({
		mutationKey: ["createJobListing"],
		mutationFn: ({ values, published }: { values: JobListingFormValues; published: boolean }) =>
			updateJobListing(joblisting!.listing_id, values, published),
		onSuccess: () => {
			toast.success("Stillingsannonse opprettet!", {
				description: `Annonse opprettet ${humanReadableDate(new Date())}`,
			});
			router.push("/job-listings");
		},
		onError: (error) => {
			toast.error("Det har skjedd en feil!");
			console.error(error);
		},
	});

	const { mutate: deleteJobListingMutate } = useMutation({
		mutationKey: ["deleteJobListing"],
		mutationFn: (id: number) => deleteJobListing(id),
		onSuccess: () => {
			toast.success("Stillingsannonse slettet!", {
				description: `Annonse slettet ${humanReadableDate(new Date())}`,
			});
			router.push("/job-listings");
		},
		onError: (error) => {
			toast.error("Det har skjedd en feil!");
			console.error(error);
		},
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
			company_id: joblisting.company_id,
			company_name: company.company_name,
		},
		contacts: joblisting.contacts.map((contact) => ({
			contact_id: contact.contact_id,
			name: contact.name,
			email: contact.email ?? undefined,
			phone: contact.phone ?? undefined,
		})),
		applicationUrl: joblisting.application_url,
	};

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

	const handleTertiaryFormSubmit = () => {
		deleteJobListingMutate(joblisting.listing_id);
	};

	return (
		<JobListingForm
			defaultValues={defaultValues}
			onPrimarySubmitAction={handlePrimaryFormSubmit}
			onSecondarySubmitAction={handleSecondaryFormSubmit}
			onTertiarySubmitAction={handleTertiaryFormSubmit}
		/>
	);
}
