"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getPageById(page_id: number) {
	const supabase = createServerClient();

	const { data: page, error } = await supabase
		.from("pages")
		.select("*")
		.eq("page_id", page_id)
		.single();

	if (error) {
		console.error(error);
		throw new Error(error.message);
	}

	return page;
}
