"use server";

import { createServerClient } from "@/lib/supabase/server";

export default async function deleteRegistration(event_id: number, user_id: string) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("event_id", event_id)
    .eq("user_id", user_id);

  if (error) {
    throw new Error(error.message);
  }
}
