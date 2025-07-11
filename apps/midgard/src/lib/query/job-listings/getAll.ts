"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getAllJobListings(type?: string, n?: number) {
	const supabase = createServerClient();

	let query = supabase
		.from("job_listings")
		.select("*, companies (company_id, company_name), company_images (company_id, id, name)")
		.eq("published", true)
		.gte("deadline", new Date().toISOString())
		.order("deadline", { ascending: false });

	if (n) {
		query = query.limit(n);
	}

	if (type) {
		query = query.eq("type", type);
	}

	const { data, error } = await query;

	if (error) {
		console.error(error);
		return [];
	}

	return data;
}
