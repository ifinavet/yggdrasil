"use client";

import { featureFlags } from "@workspace/shared/feature-flags";

import { feedbackConfig } from "@workspace/shared/feedback/constants";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
}
function isEnabled() {
	if (featureFlags.huginFeedback.uiEnabled) return true;
	try {
		return localStorage.getItem(feedbackConfig.previewStorageKey) === "true";
	} catch {
		return false;
	}
}
export function useFeedbackPreviewEnabled() {
	return useSyncExternalStore(subscribe, isEnabled, () => featureFlags.huginFeedback.uiEnabled);
}
