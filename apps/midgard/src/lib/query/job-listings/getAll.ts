"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getAllJobListings(type?: string) {
  const supabase = createServerClient();

  if (!type) {
    const { data: jobListings, error } = await supabase.from("job_listings").select("*, companies (company_id, company_name), company_images (company_id, id, name)").eq("published", true).gte("deadline", new Date().toISOString());

    if (error) {
      throw new Error(error.message);
    }

    return jobListings;
  }

  const { data: jobListings, error } = await supabase.from("job_listings").select("*, companies (company_id, company_name), company_images (company_id, id, name)").eq("type", type).eq("published", true).gte("deadline", new Date().toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return jobListings;
}
