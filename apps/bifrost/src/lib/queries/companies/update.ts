"use server";

import type { CompanyFormValues } from "@/constants/schemas/companies-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export default async function updateCompany(id: number, values: CompanyFormValues) {
  const supabase = createServerClient();

  const { error } = await supabase.from("companies").update({
    company_name: values.company_name,
    org_number: values.org_number,
    description: values.description,
    company_image: values.company_image.id,
  }).eq("company_id", id);

  if (error) {
    throw new Error(error.message);
  }
}
