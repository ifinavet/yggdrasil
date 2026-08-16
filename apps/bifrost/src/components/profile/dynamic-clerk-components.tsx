"use client";

import { OrganizationProfile, UserProfile } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import { isMockAuth, useAuthUser } from "@workspace/auth/client";
import { useTheme } from "next-themes";

function MockProfile() {
	const { user } = useAuthUser();

	return (
		<div className="rounded-lg border p-6">
			<h2 className="font-semibold text-lg">Utviklingsbruker</h2>
			<p className="mt-1 text-muted-foreground text-sm">
				Profilen administreres av Clerk i vanlig drift. Lokalt er brukerne faste seed-data.
			</p>
			<dl className="mt-4 grid gap-1 text-sm">
				<div className="flex gap-2">
					<dt className="text-muted-foreground">Navn:</dt>
					<dd>{user ? `${user.firstName} ${user.lastName}` : "Ikke innlogget"}</dd>
				</div>
				<div className="flex gap-2">
					<dt className="text-muted-foreground">E-post:</dt>
					<dd>{user?.email ?? "-"}</dd>
				</div>
			</dl>
		</div>
	);
}

export function DynamicUserProfile() {
	const { resolvedTheme } = useTheme();

	if (isMockAuth) {
		return <MockProfile />;
	}

	if (resolvedTheme === "dark") {
		return <UserProfile appearance={{ theme: dark }} />;
	} else {
		return <UserProfile />;
	}
}

export function DynamicOrganizationProfile() {
	const { resolvedTheme } = useTheme();

	if (isMockAuth) {
		return <MockProfile />;
	}

	if (resolvedTheme === "dark") {
		return <OrganizationProfile appearance={{ theme: dark }} />;
	} else {
		return <OrganizationProfile />;
	}
}
