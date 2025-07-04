"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getListingById(listingId: number) {
  const supabase = createServerClient();

  const { data: listing, error } = await supabase
    .from("job_listings")
    .select("*, job_listing_contacts(*), companies (company_id, company_name, description)")
    .eq("listing_id", listingId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return listing;
}
