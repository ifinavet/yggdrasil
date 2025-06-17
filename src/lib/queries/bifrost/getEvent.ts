"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function getEvent(id: number) {
  const client = createServerClient();

  const { data: event, error } = await client
    .from("events")
    .select("*, companies (company_id, company_name)")
    .eq("event_id", id)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch event", error);
  }

  return event;
}
