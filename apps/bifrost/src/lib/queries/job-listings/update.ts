"use server";

import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function updateJobListing(
	listing_id: number,
	formData: JobListingFormValues,
	published: boolean,
) {
	const supabase = createServerClient();

	const { error: updateError } = await supabase
		.from("job_listings")
		.update({
			title: formData.title,
			description: formData.description,
			teaser: formData.teaser,
			type: formData.type,
			company_id: formData.company.company_id,
			deadline: formData.deadline.toISOString(),
			application_url: formData.applicationUrl,
			published,
		})
		.eq("listing_id", listing_id);

	if (updateError) {
		throw new Error(updateError.message);
	}

	const { error: updateContactsError } = await supabase.from("job_listing_contacts").upsert(
		formData.contacts.map((contact) => ({
			contact_id: contact.contact_id,
			email: contact.email,
			name: contact.name,
			listing_id: listing_id,
		})),
	);

	if (updateContactsError) {
		throw new Error(updateContactsError.message);
	}
}
