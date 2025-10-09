import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import ResourceCard from "../resources/resource-card";

export default async function FavoriteResources() {
	const resources = await fetchQuery(api.resources.getFavorites);

	return resources.map((resource) => (
		<ResourceCard key={resource._id} resource={resource} className="mb-4 w-full" />
	));
}
