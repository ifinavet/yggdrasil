"use client";

import * as Sentry from "@sentry/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useAuth, useUser } from "./client";
import { isLocalDevelopment } from "./local";
import { type IsPrivateUrl, runTelemetry, withoutPrivatePages, withTelemetry } from "./telemetry";

export function initializeClientTelemetry({
	sentryDsn,
	posthogPersistence,
	initializePostHog = true,
	isPrivateUrl,
}: {
	sentryDsn: string;
	posthogPersistence?: PostHogPersistence;
	initializePostHog?: boolean;
	/** Pages Sentry must not see, such as pages whose address carries an access token. */
	isPrivateUrl?: IsPrivateUrl;
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

			...(isPrivateUrl ? withoutPrivatePages(isPrivateUrl) : {}),
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

// Cookie consent. Until a visitor says yes, PostHog keeps its state in memory only, so nothing
// is written to cookies or local storage.

const COOKIE_CONSENT_KEY = "cookie_consent";

export type CookieConsent = "yes" | "no" | "undecided";
export type PostHogPersistence = "localStorage+cookie" | "memory";

/** The visitor's stored answer, or «undecided». Safe to call where storage is blocked. */
export function cookieConsentGiven(): CookieConsent {
	try {
		const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
		return stored === "yes" || stored === "no" ? stored : "undecided";
	} catch {
		return "undecided";
	}
}

/** PostHog persistence for the stored answer: cookies only after a yes. */
export function posthogPersistence(
	consent: CookieConsent = cookieConsentGiven(),
): PostHogPersistence {
	return consent === "yes" ? "localStorage+cookie" : "memory";
}

/**
 * The visitor's answer, and how to change it. Keeps PostHog's persistence in step with it.
 * `consent` is null until storage has been read in the browser.
 */
export function useCookieConsent(): {
	consent: CookieConsent | null;
	accept: () => void;
	decline: () => void;
} {
	const [consent, setConsent] = useState<CookieConsent | null>(null);

	useEffect(() => {
		setConsent(cookieConsentGiven());
	}, []);

	useEffect(() => {
		if (consent !== null) posthog.set_config({ persistence: posthogPersistence(consent) });
	}, [consent]);

	const answer = (value: "yes" | "no") => {
		try {
			window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
		} catch {
			// Storage is blocked: the answer holds for this visit only.
		}
		setConsent(value);
	};

	return { consent, accept: () => answer("yes"), decline: () => answer("no") };
}
