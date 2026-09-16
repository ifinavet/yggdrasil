import { auth } from "./server";

export async function getAuthToken() {
	return (await (await auth()).getToken({ template: "convex" })) ?? undefined;
}
