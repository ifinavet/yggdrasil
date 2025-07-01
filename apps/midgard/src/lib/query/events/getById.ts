"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function getEventById(id: number) {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { data: event, error: event_error } = await supabase
    .from("events")
    .select("*")
    .eq("event_id", id)
    .single();

  if (event_error) {
    console.error("Error fetching event:", event_error);
    return null;
  }

  const { data: organizers, error: organizer_error } = await supabase
    .from("event_organizers")
    .select("*")
    .eq("event_id", id)

  if (organizer_error) {
    console.error("Error fetching organizer:", organizer_error);
    return null;
  }

  const mappedOrganizers = await Promise.all(organizers.map(async organizer => {
    const user = await clerk.users.getUser(organizer.user_id);
    return {
      ...organizer,
      user
    }
  }))

  console.log(mappedOrganizers)

  return {
    ...event,
    organizers: mappedOrganizers
  }
}
