"use server";

import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import { createServerClient } from "@/utils/supabase/server";

export default async function createCompany(formData: CompanyFormValues) {
  const supabase = createServerClient();

  const { error } = await supabase.from("companies").insert(formData);

  if (error) {
    throw new Error(error.message);
  }
}
