"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function getCompanyImageById(company_id: number) {
	const supabase = createServerClient();

	const { data: image_name, error: image_name_error } = await supabase
		.from("company_images")
		.select("*")
		.eq("company_id", company_id)
		.single();

	if (image_name_error || image_name.name === null || image_name.id === null) {
		console.error("Error fetching company image:", image_name_error);
		return null;
	}

	const { data: image_url } = supabase.storage.from("companies").getPublicUrl(image_name.name);

	return {
		url: image_url.publicUrl,
		name: image_name.name,
		image_id: image_name.id,
	};
}

export async function getMainSponsor() {
	const supabase = createServerClient();

	const { data: main_sponsor, error } = await supabase
		.from("companies")
		.select("*")
		.eq("main_sponsor", true)
		.single();

	if (error) {
		console.error("Error fetching main sponsor:", error);
		throw new Error("Failed to fetch main sponsor");
	}

	if (!main_sponsor) {
		console.error("Main sponsor not found");
		return null;
	}

	const sponsor_image = await getCompanyImageById(main_sponsor.company_id);

	if (!sponsor_image) {
		console.error("Error fetching sponsor image");
		return null;
	}

	return {
		...main_sponsor,
		company_image: sponsor_image.url,
	};
}
