"use server";

import { clerkClient } from "@clerk/nextjs/server";
import type { OrganizerType } from "@/constants/organizer-types";
import { createServerClient } from "@/lib/supabase/server";

export async function getLatestEvents() {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const firstDayOfThisWeek = new Date(
    new Date().setDate(new Date().getDate() - new Date().getDay()),
  );

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .filter("published", "eq", true)
    .filter("event_start", "gte", firstDayOfThisWeek.toISOString())
    .limit(7);

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  return await Promise.all(
    events.map(async (event) => {
      const { data: organizers, error: organizersError } = await supabase
        .from("event_organizers")
        .select("user_id, role")
        .eq("event_id", event.event_id);

      if (organizersError) {
        console.error(organizersError);
        throw new Error("Failed to fetch organizers", organizersError);
      }

      const mapped_organizers = await Promise.all(
        organizers.map(async (organizer) => ({
          id: organizer.user_id,
          name: (await clerk.users.getUser(organizer.user_id)).fullName || "Ukjent",
          role: organizer.role as keyof typeof OrganizerType,
        })),
      );

      return { ...event, organizers: mapped_organizers };
    }),
  );
}
