"use client";

import { useAuthUser } from "@workspace/auth/client";
import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export default function PostHogPageView({ site }: Readonly<{ site: string }>): null {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const posthog = usePostHog();

	const { isSignedIn, user } = useAuthUser();

	// Track pageviews
	useEffect(() => {
		if (pathname && posthog?.__loaded) {
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
		if (!posthog?.__loaded) return;

		if (isSignedIn && user && !posthog._isIdentified()) {
			posthog.identify(user.externalId, {
				email: user.email,
				username: user.username,
				site,
			});
		}

		if (!isSignedIn && posthog._isIdentified()) {
			posthog.reset();
		}
	}, [posthog, isSignedIn, user, site]);

	return null;
}
