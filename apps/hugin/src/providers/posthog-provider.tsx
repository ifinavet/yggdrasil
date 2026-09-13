"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export default function PostHogProvider({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	useEffect(() => {
		const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
		if (!posthogKey) return;

		posthog.init(posthogKey, {
			api_host: "/relay-aXgZ",
			ui_host: "https://eu.posthog.com",
			defaults: "2025-05-24",
			capture_pageview: false,
		});
	}, []);

	return <PHProvider client={posthog}>{children}</PHProvider>;
}
