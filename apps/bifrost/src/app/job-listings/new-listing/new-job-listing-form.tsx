"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { humanReadableFullDateTime, jobListingLatestDeadline } from "@workspace/shared/time";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import JobListingForm from "@/components/job-listings/job-listings-form/job-listing-form";
import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";

export default function NewJobListingForm() {
	const latestDeadline = new Date(jobListingLatestDeadline(Date.now()));

	const defaultValues: JobListingFormValues = {
		title: "",
		teaser: "",
		description: "",
		deadline: latestDeadline,
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

	const createJobListingMutation = useMutation(api.jobListings.mutations.create);
	const handleSubmit = (values: JobListingFormValues, published: boolean) => {
		return createJobListingMutation({
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
					description: `Annonse opprettet ${humanReadableFullDateTime(new Date())}`,
				});
				router.push("/job-listings");
			})
			.catch((error) => {
				toast.error("Det har skjedd en feil!");

				posthog.captureException(error, { site: "bifrost" });
			});
	};

	const handlePrimaryFormSubmit = (values: JobListingFormValues) => {
		return handleSubmit(values, true);
	};

	const handleSecondaryFormSubmit = (values: JobListingFormValues) => {
		return handleSubmit(values, false);
	};

	return (
		<JobListingForm
			defaultValues={defaultValues}
			latestDeadline={latestDeadline}
			onPrimarySubmitAction={handlePrimaryFormSubmit}
			onSecondarySubmitAction={handleSecondaryFormSubmit}
		/>
	);
}
