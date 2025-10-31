import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import { getAuthToken } from "./authToken";

export async function hasBasicRights() {
	const token = await getAuthToken();
	return await fetchQuery(
		api.accsessRights.checkRights,
		{ right: ["internal", "editor", "admin", "super-admin"] },
		{ token },
	);
}

export async function hasAdminRights() {
	const token = await getAuthToken();

	return await fetchQuery(
		api.accsessRights.checkRights,
		{ right: ["admin", "super-admin"] },
		{ token },
	);
}

export async function hasEditRights() {
	const token = await getAuthToken();

	return await fetchQuery(
		api.accsessRights.checkRights,
		{ right: ["admin", "super-admin", "editor"] },
		{ token },
	);
}

export async function hasAllRights() {
	const token = await getAuthToken();

	return await fetchQuery(
		api.accsessRights.checkRights,
		{ right: ["super-admin"] },
		{ token },
	);
}
