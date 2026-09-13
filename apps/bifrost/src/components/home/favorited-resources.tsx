import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import ResourceCard from "../resources/resource-card";

export default async function FavoriteResources() {
	const token = await getAuthToken();
	const resources = await fetchQuery(api.pages.queries.getFavorites, {}, { token });

	return resources.map((resource) => (
		<ResourceCard key={resource._id} resource={resource} className="mb-4 w-full" />
	));
}
