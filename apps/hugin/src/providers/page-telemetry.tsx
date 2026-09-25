"use client";

import { PostHogPageView } from "@workspace/auth/telemetry-client";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { isPrivatePath } from "@/lib/private-paths";
import { Consent } from "./consent";
import PostHogProvider from "./posthog-provider";

export default function PageTelemetry({ children }: Readonly<{ children: ReactNode }>) {
	const pathname = usePathname();
	// These addresses contain access tokens, so the pages must not initialize analytics. Nothing is
	// tracked there, so there is no cookie consent to ask for either.
	if (isPrivatePath(pathname)) return children;
	return (
		<PostHogProvider>
			{children}
			<Suspense fallback={null}>
				<PostHogPageView site="hugin" />
			</Suspense>
			<Consent />
		</PostHogProvider>
	);
}
