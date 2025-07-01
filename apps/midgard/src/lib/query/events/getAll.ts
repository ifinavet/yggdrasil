"use server";

import type { Tables } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";

export async function getAllEventsCurrentSemester(
  external: boolean
): Promise<Record<string, Tables<"published_events_with_participation_count">[]>> {
  const supabase = createServerClient();

  const today = new Date();
  let startDate: Date;
  let endDate: Date;
  if (today.getMonth() < 7) {
    startDate = new Date(today.getFullYear(), 0, 1);
    endDate = new Date(today.getFullYear(), 6, 30);
  } else {
    startDate = new Date(today.getFullYear(), 7, 1);
    endDate = new Date(today.getFullYear(), 11, 31);
  }

  const { data: events, error } = await supabase
    .from("published_events_with_participation_count")
    .select("*")
    .gte("event_start", startDate.toISOString())
    .lte("event_start", endDate.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  if (!events) {
    return {};
  }

  const selected_events = external
    ? events.filter(
      (event) =>
        event.external_url !== null && event.external_url.length > 0
    )
    : events.filter(
      (event) =>
        event.external_url === null || event.external_url.length === 0
    );

  const eventsByMonth = selected_events.reduce(
    (acc: Record<string, Tables<"published_events_with_participation_count">[]>, event) => {
      if (!event.event_start) {
        return acc;
      }
      const eventDate = new Date(event.event_start);
      const monthKey = eventDate.toLocaleString("no", { month: "long" });

      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }

      acc[monthKey].push(event);
      return acc;
    },
    {}
  );

  return eventsByMonth;
}
