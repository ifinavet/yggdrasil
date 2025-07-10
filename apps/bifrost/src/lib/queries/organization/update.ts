"use server";

import type { boardMemberSchema } from "@/constants/schemas/boardmember-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function updateBoardMember(id: number, formData: boardMemberSchema) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("organization")
    .update({
      user_id: formData.userID,
      position: formData.role,
      group_name: formData.group,
    })
    .eq("organization_id", id);

  if (error) {
    throw new Error(error.message);
  }

  return;
}
