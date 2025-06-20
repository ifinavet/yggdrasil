"use server";

import type { ResourceSchemaValues } from "@/utils/bifrost/schemas/resource-form-schema";
import { createServerClient } from "@/utils/supabase/server";

export default async function createResource(
  formData: ResourceSchemaValues,
  published: boolean,
) {
  const supabase = createServerClient();

  const { error } = await supabase.from("resources").insert({
    ...formData,
    published,
  });

  if (error) {
    throw new Error(error.message);
  }
}
