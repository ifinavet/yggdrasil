"use server";

import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import { createServerClient } from "@/utils/supabase/server";

export default async function createCompany(formData: CompanyFormValues) {
  const supabase = createServerClient();

  const { error } = await supabase.from("companies").insert({
    company_name: formData.company_name,
    description: formData.description,
    org_number: formData.org_number,
    company_image: formData.company_image.id,
  });

  if (error) {
    throw new Error(error.message);
  }
}
