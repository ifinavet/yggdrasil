import { createServerClient } from "@/lib/supabase/server";

export async function getRegistrationsById(userId: string) {
  const supabase = createServerClient();

  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("*, events (event_id, title, event_start)")
    .eq("user_id", userId)

  if (error) {
    console.error(error);
    return [];
  }

  if (!registrations) {
    return [];
  }

  console.log(typeof registrations)

  return registrations
}

export async function getPointsById(userId: string) {
  const supabase = createServerClient();

  const { data: points, error } = await supabase
    .from("points")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch profile");
  }

  if (!points) {
    return [];
  }

  return points;
}
