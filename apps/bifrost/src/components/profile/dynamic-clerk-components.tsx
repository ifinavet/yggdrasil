"use client";

import { OrganizationProfile, UserProfile } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

export function DynamicUserProfile() {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme === "dark") {
    return <UserProfile appearance={{ baseTheme: dark }} />;
  } else {
    return <UserProfile />;
  }
}

export function DynamicOrganizationProfile() {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme === "dark") {
    return <OrganizationProfile appearance={{ baseTheme: dark }} />;
  } else {
    return <OrganizationProfile />;
  }
}
