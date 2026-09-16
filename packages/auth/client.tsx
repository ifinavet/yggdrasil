"use client";

import * as Clerk from "@clerk/nextjs";
import type { ComponentProps } from "react";
import { isLocalDevelopment, localUser } from "./local";

function useLocalUser() {
	return { isLoaded: true, isSignedIn: true, user: localUser };
}
function useLocalAuth() {
	return { isLoaded: true, isSignedIn: true, userId: localUser.id };
}
function LocalProfile() {
	return <p>Local Developer — local development account</p>;
}
function LocalSignOut(_props: ComponentProps<typeof Clerk.SignOutButton>) {
	return <span>Local development account</span>;
}

export const useUser = isLocalDevelopment ? useLocalUser : Clerk.useUser;
export const useAuth = isLocalDevelopment ? useLocalAuth : Clerk.useAuth;
export const SignOutButton = isLocalDevelopment ? LocalSignOut : Clerk.SignOutButton;
export const SignIn = isLocalDevelopment ? LocalProfile : Clerk.SignIn;
export const UserProfile = isLocalDevelopment ? LocalProfile : Clerk.UserProfile;
export const OrganizationProfile = isLocalDevelopment ? LocalProfile : Clerk.OrganizationProfile;
