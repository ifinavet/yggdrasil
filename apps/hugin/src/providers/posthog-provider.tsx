"use client";

import { runTelemetry } from "@workspace/auth/telemetry";
import { posthogPersistence } from "@workspace/auth/telemetry-client";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { isPrivateUrl } from "@/lib/private-paths";

export default function PostHogProvider({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	useEffect(() => {
		runTelemetry(() => {
			if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
				throw new Error("PostHog environment variables are not set");
			}

			posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
				api_host: "/relay-aXgZ",
				ui_host: "https://eu.posthog.com",
				defaults: "2025-05-24",
				capture_pageview: false,
				// Cookies and local storage only after the visitor has said yes; see Consent.
				persistence: posthogPersistence(),
				// A visitor can move on to a token page in the same tab; nothing from there is sent.
				before_send: (event) =>
					event && isPrivateUrl(event.properties?.$current_url) ? null : event,
			});
		});
	}, []);

	return <PHProvider client={posthog}>{children}</PHProvider>;
}
