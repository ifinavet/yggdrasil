"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getBoardMember(organisationID: number) {
	const supabase = createServerClient();

	const { data: boardMember, error } = await supabase
		.from("organization")
		.select("*")
		.eq("organization_id", organisationID)
		.single();

	if (error) {
		console.error(error);
		return null;
	}

	return boardMember;
}
