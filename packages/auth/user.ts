import { auth, currentUser } from "@clerk/nextjs/server";
import { DEV_AUTH_COOKIE } from "@workspace/shared/constants";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { devAuthConfigured, findDevUser } from "./dev/signing";
import { isMockAuth } from "./mode";

export type AuthUser = {
	readonly externalId: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly fullName: string;
	readonly email: string;
	readonly imageUrl: string;
};

export async function getAuthUserId(): Promise<string | null> {
	if (isMockAuth) {
		if (!devAuthConfigured()) return null;
		return findDevUser((await cookies()).get(DEV_AUTH_COOKIE)?.value)?.externalId ?? null;
	}

	return (await auth()).userId;
}

export async function redirectToSignIn() {
	if (isMockAuth) redirect("/sign-in");

	return (await auth()).redirectToSignIn();
}

export async function getAuthUser(): Promise<AuthUser | null> {
	if (isMockAuth) {
		if (!devAuthConfigured()) return null;

		const user = findDevUser((await cookies()).get(DEV_AUTH_COOKIE)?.value);
		if (!user) return null;

		return {
			externalId: user.externalId,
			firstName: user.firstName,
			lastName: user.lastName,
			fullName: `${user.firstName} ${user.lastName}`,
			email: user.email,
			imageUrl: "",
		};
	}

	const user = await currentUser();
	if (!user) return null;

	return {
		externalId: user.id,
		firstName: user.firstName ?? "",
		lastName: user.lastName ?? "",
		fullName: user.fullName ?? "",
		email: user.primaryEmailAddress?.emailAddress ?? "",
		imageUrl: user.imageUrl,
	};
}
