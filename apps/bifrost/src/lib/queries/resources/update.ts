"use server";

import type { ResourceFormValues } from "@/constants/schemas/resource-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export default async function updateResource(
	resource_id: number,
	values: ResourceFormValues,
	published: boolean,
) {
	const supabase = createServerClient();

	const { error } = await supabase
		.from("resources")
		.update({ ...values, published })
		.eq("resource_id", resource_id);

	if (error) throw error;
}
