"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function getCompanies() {
  const supabase = createServerClient();

  const { data: companies, error } = await supabase
    .from("companies")
    .select("company_id, company_name");

  if (error) {
    console.error("Error fetching companies:", error);
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }

  return companies ?? [];
}
