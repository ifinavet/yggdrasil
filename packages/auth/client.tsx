"use client";

import * as Clerk from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useSignUp } from "@clerk/nextjs/legacy";
import type { ClerkAPIError } from "@clerk/nextjs/types";
import type { ComponentProps } from "react";
import { isLocalDevelopment, type LocalUser, localUser } from "./local";

export { isClerkAPIResponseError };
export { useSignUp };
export type { ClerkAPIError };

function useLocalUser(): { isLoaded: true; isSignedIn: true; user: LocalUser } {
	return { isLoaded: true, isSignedIn: true, user: localUser };
}
function useLocalAuth(): { isLoaded: true; isSignedIn: true; userId: string } {
	return { isLoaded: true, isSignedIn: true, userId: localUser.id };
}
export function LocalAuthNotice(_props: Record<string, unknown>) {
	return <p>Local Developer (local development account)</p>;
}
function LocalSignOut({ children }: ComponentProps<typeof Clerk.SignOutButton>) {
	return <span>{children}</span>;
}

export const useUser = isLocalDevelopment ? useLocalUser : Clerk.useUser;
export const useAuth = isLocalDevelopment ? useLocalAuth : Clerk.useAuth;
export const SignOutButton = isLocalDevelopment ? LocalSignOut : Clerk.SignOutButton;
export const SignIn = isLocalDevelopment ? LocalAuthNotice : Clerk.SignIn;
export const UserProfile = isLocalDevelopment ? LocalAuthNotice : Clerk.UserProfile;
export const OrganizationProfile = isLocalDevelopment ? LocalAuthNotice : Clerk.OrganizationProfile;
