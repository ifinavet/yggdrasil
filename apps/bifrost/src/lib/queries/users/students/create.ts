"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function giveStudentPoints(user_id: string, formData: { reason: string, severity: number }) {
  const supabase = createServerClient();

  const { error } = await supabase.from("points").insert({
    user_id,
    reason: formData.reason,
    severity: formData.severity,
  });

  if (error) {
    console.error(error);
    throw new Error("Failed to give points");
  }

  return;
}
