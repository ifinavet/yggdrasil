"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function getJobListingById(
  listing_id: number,
) {
  const supabase = createServerClient();

  const { data: jobListing, error } = await supabase
    .from("job_listings")
    .select("*")
    .eq("listing_id", listing_id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("job_listing_contacts")
    .select("*")
    .eq("listing_id", listing_id);

  if (contactsError) {
    throw new Error(contactsError.message);
  }

  return { ...jobListing, contacts };
}
