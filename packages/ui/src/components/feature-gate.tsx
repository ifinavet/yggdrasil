"use client";

import { featureFlags, type GatedFeature } from "@workspace/shared/feature-flags";
import { useFeatureEnabled } from "@workspace/ui/hooks/use-feature-enabled";
import { type ReactNode, useSyncExternalStore } from "react";

const noSubscription = () => () => {};

function useHydrated() {
	return useSyncExternalStore(
		noSubscription,
		() => true,
		() => false,
	);
}

export function FeatureGate({
	feature,
	children,
	fallback = null,
}: Readonly<{ feature: GatedFeature; children: ReactNode; fallback?: ReactNode }>) {
	const enabled = useFeatureEnabled(feature);
	const hydrated = useHydrated();

	if (featureFlags[feature].uiEnabled) return children;
	if (!hydrated) return null;
	return enabled ? children : fallback;
}
