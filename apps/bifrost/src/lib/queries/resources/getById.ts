"use server";

import { createServerClient } from "@/lib/supabase/server";

export default async function getResourceById(resource_id: number) {
  const supabase = createServerClient();

  const { data: resource, error: resourcesError } = await supabase
    .from("resources")
    .select("*")
    .eq("resource_id", resource_id)
    .single();

  if (resourcesError) {
    console.error("Error fetching resource:", resourcesError);
    throw new Error("Error fetching resource");
  }

  return resource;
}
