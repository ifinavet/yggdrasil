"use server";

import type { EventFormValues } from "@/constants/schemas/event-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export default async function createEvent(values: EventFormValues, published: boolean) {
	const supabase = createServerClient();
	const { data: event_res, error: event_err_res } = await supabase
		.from("events")
		.insert({
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
			published: published,
		})
		.select("event_id")
		.single();

	if (!event_res) {
		console.error("Error inserting event:", event_err_res);
		throw event_err_res;
	}

	const { data: organizers_res, error: organizers_err_res } = await supabase
		.from("event_organizers")
		.insert(
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
