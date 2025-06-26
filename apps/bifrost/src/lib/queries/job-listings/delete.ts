"use server";

import { createServerClient } from "@/lib/supabase/server";

export default async function deleteJobListing(listing_id: number) {
  const supabase = createServerClient();

  const { error: errorOnDelete } = await supabase
    .from("job_listings")
    .delete()
    .eq("listing_id", listing_id);

  if (errorOnDelete) {
    throw new Error(errorOnDelete?.message || "Failed to delete job listing");
  }
}
