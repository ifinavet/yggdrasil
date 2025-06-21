"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/utils/supabase/server";

export default async function getRegistrations(event_id: number) {
	const supabase = createServerClient();
	const clerk = await clerkClient();

	const { data: registrations, error } = await supabase
		.from("registrations")
		.select("*")
		.eq("event_id", event_id);

	if (error) {
		throw new Error(error.message);
	}

	const mappedRegistrations = await Promise.all(
		registrations.map(async (attendee) => {
			const user = await clerk.users.getUser(attendee.user_id);
			return {
				...attendee,
				email: user.emailAddresses[0]?.emailAddress,
				name: user.fullName,
			};
		}),
	);

	const registered = mappedRegistrations.filter(
		(registration) => registration.status === "registered",
	);

	const waitlist = mappedRegistrations.filter((registration) => registration.status === "waitlist");

	return {
		registered,
		waitlist,
	};
}

export async function deleteRegistration(event_id: number, user_id: string) {
	const supabase = createServerClient();

	const { error } = await supabase
		.from("registrations")
		.delete()
		.eq("event_id", event_id)
		.eq("user_id", user_id);

	if (error) {
		throw new Error(error.message);
	}
}

export async function updateRegistration(event_id: number, user_id: string, status: string) {
	const supabase = createServerClient();

	const { error } = await supabase
		.from("registrations")
		.update({ attendance_status: status })
		.eq("event_id", event_id)
		.eq("user_id", user_id);

	if (error) {
		throw new Error(error.message);
	}
}
