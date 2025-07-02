"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function deleteRegistration(user_id: string, event_id: number) {
	const supabase = createServerClient();

	const { error } = await supabase
		.from("registrations")
		.delete()
		.eq("user_id", user_id)
		.eq("event_id", event_id);

	if (error) {
		console.error(error);
		throw new Error("Failed to delete registration");
	}

	return;
}
