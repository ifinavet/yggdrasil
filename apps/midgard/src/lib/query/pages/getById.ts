"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getInfoPageById(id: number) {
	const supabase = createServerClient();

	const { data: page, error } = await supabase
		.from("pages")
		.select("*")
		.eq("page_id", id)
		.eq("published", true)
		.single();

	if (error) {
		console.error(error);
		return null;
	}

	return page;
}
