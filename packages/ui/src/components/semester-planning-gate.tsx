"use client";

import { featureFlags } from "@workspace/shared/feature-flags";
import { type ReactNode, useSyncExternalStore } from "react";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";

const noSubscription = () => () => {};

/** Whether semester planning is shown: to everyone once released, or to a browser that opted in. */
export function useSemesterPlanningEnabled(): boolean {
	const optedIn = useBrowserOptIn("semesterPlanningPreview");
	return featureFlags.semesterPlanning.uiEnabled || optedIn;
}

/**
 * Shows semester planning only while it is enabled, and the fallback otherwise. The opt-in lives in
 * the browser, so nothing is shown until the page has hydrated.
 */
export function SemesterPlanningGate({
	children,
	fallback = null,
}: Readonly<{ children: ReactNode; fallback?: ReactNode }>) {
	const enabled = useSemesterPlanningEnabled();
	const hydrated = useSyncExternalStore(
		noSubscription,
		() => true,
		() => false,
	);

	if (featureFlags.semesterPlanning.uiEnabled) return children;
	if (!hydrated) return null;
	return enabled ? children : fallback;
}
