"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function signUp(event_id: number, user_id: string, waitlist: boolean, note?: string) {
	const supabase = createServerClient();

	const { error } = await supabase.from("registrations").insert({
		event_id,
		user_id,
		note,
		status: waitlist ? "waitlist" : "registered",
	});

	if (error) {
		throw new Error(error.message);
	}

	return;
}
