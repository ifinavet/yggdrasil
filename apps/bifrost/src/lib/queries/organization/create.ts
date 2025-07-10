"use server";

import type { boardMemberSchema } from "@/constants/schemas/boardmember-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function createBoardmember(data: boardMemberSchema) {
  const supabase = createServerClient();

  const { error } = await supabase.from("organization").insert({
    user_id: data.userID,
    group_name: data.group,
    position: data.role,
  });

  if (error) {
    throw new Error(error.message);
  }
}
