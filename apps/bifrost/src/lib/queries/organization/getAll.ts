"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function getBoardMembers() {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { data: boardMembers, error } = await supabase
    .from("organization")
    .select("*")
    .neq("position", "internal");

  if (error) {
    console.error(error);
    return [];
  }

  const mappedBoardMembers = Promise.all(
    boardMembers.map(async (member) => {
      const user = await clerk.users.getUser(member.user_id);
      return {
        organizationId: member.organization_id,
        id: user.id,
        fullname: user?.fullName,
        position: member.position,
        email: user?.primaryEmailAddress?.emailAddress,
        image: user?.imageUrl
      };
    }),
  );

  return mappedBoardMembers;
}

export async function getAllInternalMembers(orgId: string) {
  const client = await clerkClient();
  const { data } = await client.users.getUserList({
    orderBy: "last_name",
    organizationId: [orgId],
    limit: 100,
  });

  return data.map((user) => {
    return {
      id: user.id,
      fullname: user.fullName,
    };
  });
}
