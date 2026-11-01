import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import { getAuthToken } from "./authToken";

export async function hasBasicRights() {
	const token = await getAuthToken();
	return await fetchQuery(
		api.auth.accessRights.checkRights,
		{ right: ["internal", "editor", "admin", "super-admin"] },
		{ token },
	);
}

export async function hasAdminRights() {
	const token = await getAuthToken();

	return await fetchQuery(
		api.auth.accessRights.checkRights,
		{ right: ["admin", "super-admin"] },
		{ token },
	);
}

export async function hasEditRights() {
	const token = await getAuthToken();

	return await fetchQuery(
		api.auth.accessRights.checkRights,
		{ right: ["admin", "super-admin", "editor"] },
		{ token },
	);
}

export async function hasAllRights() {
	const token = await getAuthToken();

	return await fetchQuery(api.auth.accessRights.checkRights, { right: ["super-admin"] }, { token });
}

/** What the caller may do in Semesterplan: the board, members the board let in, and super-admins. */
export async function semesterPlanRights() {
	const token = await getAuthToken();

	return await fetchQuery(api.semesterPlanning.access.queries.myRights, {}, { token });
}
