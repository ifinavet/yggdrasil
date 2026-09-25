"use client";

import { type PreviewFeature, previewFeatures } from "@workspace/shared/feature-flags";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";
import { type ReactNode, useSyncExternalStore } from "react";

const noSubscription = () => () => {};

export function useFeatureEnabled(feature: PreviewFeature): boolean {
	const optedIn = useBrowserOptIn(previewFeatures[feature].optIn);
	return previewFeatures[feature].released || optedIn;
}

export function FeatureGate({
	feature,
	children,
	fallback = null,
}: Readonly<{ feature: PreviewFeature; children: ReactNode; fallback?: ReactNode }>) {
	const enabled = useFeatureEnabled(feature);
	const hydrated = useSyncExternalStore(
		noSubscription,
		() => true,
		() => false,
	);

	if (previewFeatures[feature].released) return children;
	if (!hydrated) return null;
	return enabled ? children : fallback;
}
