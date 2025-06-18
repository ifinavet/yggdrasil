"use server";

import { createServerClient } from "@/utils/supabase/server";
import type { EventFormValues } from "../../../utils/bifrost/schemas/event-form-schema";

export default async function updateEvent(
  event_id: number,
  values: EventFormValues,
  visible: boolean,
) {
  const supabase = createServerClient();
  const { data: event_res, error: event_err_res } = await supabase
    .from("events")
    .update({
      title: values.title,
      teaser: values.teaser,
      description: values.description,
      event_start: values.eventDate.toISOString(),
      registration_opens: values.registrationDate.toISOString(),
      location: values.location,
      food: values.food,
      language: values.language,
      age_restrictions: values.ageRestrictions,
      external_url: values.externalUrl,
      company_id: values.hostingCompany.company_id,
      participants_limit: values.participantsLimit,
      visible,
    })
    .eq("event_id", event_id)
    .select("event_id")
    .single();

  if (!event_res) {
    console.error("Error inserting event:", event_err_res);
    throw event_err_res;
  }

  const organizersToKeep = values.organizers.map((organizer) => organizer.id);
  const { error: delete_err } = await supabase
    .from("event_organizers")
    .delete()
    .eq("event_id", event_res.event_id)
    .not("user_id", "in", `(${organizersToKeep.join(",")})`);

  if (delete_err) {
    console.error("Error deleting event organizers:", delete_err);
    throw delete_err;
  }

  const { data: organizers_res, error: organizers_err_res } = await supabase
    .from("event_organizers")
    .upsert(
      values.organizers.map((organizer) => ({
        event_id: event_res.event_id,
        user_id: organizer.id,
        role: organizer.role,
      })),
    )
    .select();

  if (!organizers_res) {
    console.error("Error inserting event organizers:", organizers_err_res);
    throw organizers_err_res;
  }

  return;
}
