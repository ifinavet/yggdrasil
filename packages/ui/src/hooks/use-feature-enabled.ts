"use client";

import {
	featureFlags,
	featurePreviewOptIns,
	type GatedFeature,
} from "@workspace/shared/feature-flags";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";

export function useFeatureEnabled(feature: GatedFeature): boolean {
	const optedIn = useBrowserOptIn(featurePreviewOptIns[feature]);
	return featureFlags[feature].uiEnabled || optedIn;
}
