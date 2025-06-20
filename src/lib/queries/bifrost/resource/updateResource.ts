"use server";

import type { ResourceSchemaValues } from "@/utils/bifrost/schemas/resource-form-schema";
import { createServerClient } from "@/utils/supabase/server";

export default async function updateResource(
  resource_id: number,
  values: ResourceSchemaValues,
  published: boolean,
) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("resources")
    .update({ ...values, published })
    .eq("resource_id", resource_id);

  if (error) throw error;
}
