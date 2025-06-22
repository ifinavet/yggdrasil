"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function getAllJobListings() {
  const supabase = createServerClient();

  const { data: jobListings, error: errorOnFetch } = await supabase
    .from("job_listings")
    .select("*").order("deadline", { ascending: false });

  if (errorOnFetch || !jobListings) {
    throw new Error(errorOnFetch.message || "Failed to fetch job listings");
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("job_listing_contacts")
    .select("*");

  if (contactsError) {
    throw new Error(contactsError.message);
  }

  const mapped = jobListings.map(listing => ({
    ...listing,
    contacts: contacts.filter(contact => contact.listing_id === listing.listing_id)
  }));

  return mapped;
}
