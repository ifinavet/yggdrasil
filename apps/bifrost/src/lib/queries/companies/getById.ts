"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function getCompanyById(id: number) {
  const supabase = createServerClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("company_id", id)
    .single();

  if (!company) {
    throw new Error("Company not found");
  }

  return company;
}
