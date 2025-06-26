"use server";

import type { ResourceFormValues } from "@/constants/schemas/resource-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export default async function createResource(formData: ResourceFormValues, published: boolean) {
  const supabase = createServerClient();

  const { error } = await supabase.from("resources").insert({
    ...formData,
    published,
  });

  if (error) {
    throw new Error(error.message);
  }
}
