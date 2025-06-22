"use server";

import { createServerClient } from "@/utils/supabase/server";

export default async function getResources() {
	const supabase = createServerClient();

	const { data: resources, error: resourcesError } = await supabase.from("resources").select("*");

	if (resourcesError) {
		console.error("Error fetching resources:", resourcesError);
		throw new Error("Error fetching resources");
	}
	const publishedResources = resources.filter((resource) => resource.published);
	const unpublishedResources = resources.filter((resource) => !resource.published);

	// Group resources by tag
	const groupedResources = publishedResources.reduce(
		(
			groups: {
				[key: string]: {
					content: string;
					created_at: string | null;
					excerpt: string | null;
					published: boolean;
					resource_id: number;
					tag: string | null;
					title: string;
					updated_at: string | null;
				}[];
			},
			resource: {
				content: string;
				created_at: string | null;
				excerpt: string | null;
				published: boolean;
				resource_id: number;
				tag: string | null;
				title: string;
				updated_at: string | null;
			},
		) => {
			const tag = resource.tag || "uncategorized";
			if (!groups[tag]) {
				groups[tag] = [];
			}
			groups[tag].push(resource);
			return groups;
		},
		{},
	);

	return { groupedResources, unpublishedResources };
}
