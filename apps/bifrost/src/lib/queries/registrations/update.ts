"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function updateRegistration(event_id: number, user_id: string, status: string) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("registrations")
    .update({ attendance_status: status })
    .eq("event_id", event_id)
    .eq("user_id", user_id);

  if (error) {
    throw new Error(error.message);
  }
}
