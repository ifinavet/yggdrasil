"use client";

import { PostHogPageView } from "@workspace/auth/telemetry-client";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import PostHogProvider from "./posthog-provider";

export default function PageTelemetry({ children }: Readonly<{ children: ReactNode }>) {
	const pathname = usePathname();
	// Invitation fragments contain access tokens, so this page must not initialize analytics.
	if (pathname === "/feedback") return children;
	return (
		<PostHogProvider>
			{children}
			<Suspense fallback={null}>
				<PostHogPageView site="hugin" />
			</Suspense>
		</PostHogProvider>
	);
}
