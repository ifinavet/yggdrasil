"use server";

import { createServerClient } from "@/lib/supabase/server";

interface FileObject {
	name: string;
	id: string;
	updated_at: string;
	created_at: string;
	last_accessed_at: string;
	metadata: Record<string, unknown>;
}

export default async function getAllCompanyImages({
	pageParam,
}: {
	pageParam: number;
}): Promise<{ data: FileObject[]; nextPage: number | null }> {
	const client = createServerClient();

	const pageSize = 20;

	const { data: company_images, error: company_images_error } = await client.storage
		.from("companies")
		.list("company_images", {
			limit: pageSize,
			offset: pageParam,
			sortBy: { column: "created_at", order: "asc" },
		});

	if (company_images_error) {
		console.error("Error fetching company images:", company_images_error);
		return { data: [], nextPage: null };
	}

	if (company_images.length === 0) {
		return { data: [], nextPage: null };
	}

	return { data: company_images || [], nextPage: pageParam + pageSize };
}
