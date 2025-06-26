"use server";

import { createServerClient } from "@/lib/supabase/server";

export default async function getAllCompanies() {
  const supabase = createServerClient();

  const { data: companies, error } = await supabase.from("companies").select("*");

  if (error) {
    console.error("Error fetching companies:", error);
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }

  return companies ?? [];
}
