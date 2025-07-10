"use server";

import { clerkClient } from "@clerk/nextjs/server";
import type { Tables } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

export async function getEventById(id: number) {
  const supabase = createServerClient();
  const clerk = await clerkClient();

  const { data: event, error: event_error } = await supabase
    .from("events")
    .select("*, companies (company_id, company_name, description)")
    .eq("event_id", id)
    .single();

  const { data: registrations, error: registrations_error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", id);

  if (event_error || registrations_error) {
    console.error("Error fetching event:", event_error);
    return null;
  }

  const { data: organizers, error: organizer_error } = await supabase
    .from("event_organizers")
    .select("*")
    .eq("event_id", id);

  if (organizer_error) {
    console.error("Error fetching organizer:", organizer_error);
    return null;
  }

  const mappedOrganizers = await Promise.all(
    organizers.map(async (organizer: Tables<"event_organizers">) => {
      const user = await clerk.users.getUser(organizer.user_id);
      return {
        ...organizer,
        user,
      };
    }),
  );

  const registrationsByStatus =
    registrations?.reduce(
      (acc: Record<string, Tables<"registrations">[]>, registration: Tables<"registrations">) => {
        const status = registration.status || "unknown";
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(registration);
        return acc;
      },
      {},
    ) || {};

  return {
    ...event,
    registrations,
    registrations_by_status: registrationsByStatus,
    organizers: mappedOrganizers,
  };
}
