"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function getBoardMemberByPosition(position: string) {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { data: boardMember, error } = await supabase
    .from("organization")
    .select("*")
    .eq("position", position)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!boardMember) {
    throw new Error("Board member not found");
  }

  const user = await clerk.users.getUser(boardMember.user_id)

  return { user, boardMember };
}
