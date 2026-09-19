"use client";

import * as Sentry from "@sentry/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { useAuth, useUser } from "./client";
import { isLocalDevelopment } from "./local";
import { runTelemetry, withTelemetry } from "./telemetry";

export function initializeClientTelemetry({
	sentryDsn,
	posthogPersistence,
	initializePostHog = true,
}: {
	sentryDsn: string;
	posthogPersistence?: "localStorage+cookie" | "memory";
	initializePostHog?: boolean;
}): void {
	runTelemetry(() => {
		if (!initializePostHog) return;
		if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
			throw new Error("PostHog environment variables are not set");
		}

		posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
			api_host: "/relay-aXgZ",
			ui_host: "https://eu.posthog.com",
			defaults: "2025-05-24",
			persistence: posthogPersistence,
		});
	});

	Sentry.init(
		withTelemetry({
			dsn: sentryDsn,

			// Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
			tracesSampleRate: 1,
			// Enable logs to be sent to Sentry
			enableLogs: true,

			// Setting this option to true will print useful information to the console while you're setting up Sentry.
			debug: false,
		}),
	);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

export function PostHogPageView({ site }: Readonly<{ site: string }>): null {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const posthog = usePostHog();

	const { isLoaded, isSignedIn, userId } = useAuth();
	const { user } = useUser();

	useEffect(() => {
		if (isLocalDevelopment || !pathname || !posthog) return;
		let url = window.origin + pathname;
		if (searchParams.toString()) {
			url = `${url}?${searchParams.toString()}`;
		}
		posthog.capture("$pageview", {
			$current_url: url,
		});
	}, [pathname, searchParams, posthog]);

	useEffect(() => {
		if (isLocalDevelopment || !isLoaded) return;
		if (isSignedIn && userId && user && posthog.get_distinct_id() !== userId) {
			posthog.identify(userId, {
				email: user.primaryEmailAddress?.emailAddress,
				username: user.username,
				site,
			});
		}

		if (isSignedIn === false && posthog._isIdentified()) {
			posthog.reset();
		}
	}, [posthog, user, isLoaded, isSignedIn, userId, site]);

	return null;
}
