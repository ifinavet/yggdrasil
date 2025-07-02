"use server";

import type { PageFormValues } from "@/constants/schemas/page-form-schema";
import { createServerClient } from "@/lib/supabase/server";

export async function updatePage(page_id: number, formValues: PageFormValues, published: boolean) {
	const supabase = createServerClient();

	const { error } = await supabase
		.from("pages")
		.update({
			title: formValues.title,
			content: formValues.content,
			published,
		})
		.eq("page_id", page_id);

	if (error) {
		throw new Error(error.message);
	}

	return;
}
