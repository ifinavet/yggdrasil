"use server";

import { clerkClient } from "@clerk/nextjs/server";
import type { OrganizerType } from "@/shared/enums";
import { createServerClient } from "@/utils/supabase/server";

export default async function getEvent(id: number) {
	const client = createServerClient();
	const clerk = await clerkClient();

	const { data: event, error } = await client
		.from("events")
		.select("*, companies (company_id, company_name)")
		.eq("event_id", id)
		.single();

	if (error) {
		console.error(error);
		throw new Error("Failed to fetch event", error);
	}

	const { data: organizers, error: organizersError } = await client
		.from("event_organizers")
		.select("user_id, role")
		.eq("event_id", id);

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
}
