"use client";

import { runTelemetry } from "@workspace/auth/telemetry";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

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
			});
		});
	}, []);

	return <PHProvider client={posthog}>{children}</PHProvider>;
}
