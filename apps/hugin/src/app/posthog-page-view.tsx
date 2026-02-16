"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export default function PostHogPageView(): null {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const posthog = usePostHog();

	const { isSignedIn, userId } = useAuth();
	const { user } = useUser();

	// Track pageviews
	useEffect(() => {
		if (pathname && posthog) {
			let url = window.origin + pathname;
			if (searchParams.toString()) {
				url = `${url}?${searchParams.toString()}`;
			}
			posthog.capture("$pageview", {
				$current_url: url,
			});
		}
	}, [pathname, searchParams, posthog]);

	useEffect(() => {
		if (isSignedIn && userId && user && !posthog._isIdentified()) {
			posthog.identify(userId, {
				email: user.primaryEmailAddress?.emailAddress,
				username: user.username,
				site: "hugin",
			});
		}

		if (!isSignedIn && posthog._isIdentified()) {
			posthog.reset();
		}
	}, [posthog, user, isSignedIn, userId]);

	return null;
}
