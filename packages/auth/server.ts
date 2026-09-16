import { auth as clerkAuth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { connection } from "next/server";
import { isLocalDevelopment, localUser } from "./local";

export async function auth() {
	if (!isLocalDevelopment) return clerkAuth();
	await connection();
	return {
		userId: localUser.id,
		isAuthenticated: true,
		getToken: async (_options?: { template?: string }) => null,
		redirectToSignIn: () => {
			throw new Error("Local development user is already signed in");
		},
	};
}

export async function currentUser() {
	if (!isLocalDevelopment) return clerkCurrentUser();
	await connection();
	return localUser;
}
