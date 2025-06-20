"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function deleteCompany(id: number) {
  const client = createServerClient();

  const { error } = await client
    .from("companies")
    .delete()
    .eq("company_id", id);

  if (error) {
    throw new Error(error.message);
  }
}
