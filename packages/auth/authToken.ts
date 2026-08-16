import { auth } from "@clerk/nextjs/server";
import { DEV_AUTH_COOKIE } from "@workspace/shared/constants";
import { cookies } from "next/headers";
import { devAuthConfigured, findDevUser, mintDevToken } from "./dev/signing";
import { isMockAuth } from "./mode";

export async function getAuthToken(): Promise<string | undefined> {
	if (isMockAuth) {
		if (!devAuthConfigured()) return undefined;

		const user = findDevUser((await cookies()).get(DEV_AUTH_COOKIE)?.value);
		return user ? await mintDevToken(user) : undefined;
	}

	return (await (await auth()).getToken({ template: "convex" })) ?? undefined;
}
