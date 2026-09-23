"use client";

import { feedbackConfig } from "@workspace/shared/feedback/constants";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
}
function isEnabled() {
	if (feedbackConfig.uiEnabled) return true;
	try {
		return localStorage.getItem(feedbackConfig.previewStorageKey) === "true";
	} catch {
		return false;
	}
}
export function useFeedbackPreviewEnabled() {
	return useSyncExternalStore(subscribe, isEnabled, () => feedbackConfig.uiEnabled);
}
