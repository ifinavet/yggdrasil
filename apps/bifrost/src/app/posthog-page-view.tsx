"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/auth-client";

export default function PostHogPageView(): null {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const posthog = usePostHog();

	const { data } = authClient.useSession();

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
		const user = data?.user;
		if (data && user && user?.id && !posthog._isIdentified()) {
			posthog.identify(user.id, {
				email: user.email,
				username: user.name,
				site: "bifrost",
			});
		}

		if (!data && posthog._isIdentified()) {
			posthog.reset();
		}
	}, [posthog, data]);

	return null;
}
