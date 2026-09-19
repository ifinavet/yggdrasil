"use client";

import { dark } from "@clerk/ui/themes";
import { OrganizationProfile, UserProfile } from "@workspace/auth/client";
import { useTheme } from "next-themes";

export function DynamicUserProfile() {
	const { resolvedTheme } = useTheme();

	if (resolvedTheme === "dark") {
		return <UserProfile appearance={{ theme: dark }} />;
	} else {
		return <UserProfile />;
	}
}

export function DynamicOrganizationProfile() {
	const { resolvedTheme } = useTheme();

	if (resolvedTheme === "dark") {
		return <OrganizationProfile appearance={{ theme: dark }} />;
	} else {
		return <OrganizationProfile />;
	}
}
