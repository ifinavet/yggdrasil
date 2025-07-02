"use server";

import type { JobListingFormValues } from "@/constants/schemas/job-listing-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function createJobListing(data: JobListingFormValues, published: boolean) {
	const supabase = createServerClient();

	const { data: createdJobListing, error: errorOnCreate } = await supabase
		.from("job_listings")
		.insert({
			title: data.title,
			company_id: data.company.company_id,
			type: data.type,
			teaser: data.teaser,
			description: data.description,
			deadline: data.deadline.toISOString(),
			application_url: data.applicationUrl,
			published,
		})
		.select("listing_id")
		.single();

	if (errorOnCreate) {
		throw new Error(errorOnCreate?.message || "Failed to create job listing");
	}

	const { error: errorOnCreateContacts } = await supabase.from("job_listing_contacts").insert(
		data.contacts.map((contact) => ({
			name: contact.name,
			email: contact.email,
			phone: contact.phone,
			listing_id: createdJobListing.listing_id,
		})),
	);

	if (errorOnCreateContacts) {
		throw new Error(errorOnCreateContacts?.message || "Failed to create job listing contacts");
	}
}
