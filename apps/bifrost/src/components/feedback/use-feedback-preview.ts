"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
}
function isEnabled() {
	try {
		return localStorage.getItem("hugin-feedback-preview") === "true";
	} catch {
		return false;
	}
}
export function useFeedbackPreviewEnabled() {
	return useSyncExternalStore(subscribe, isEnabled, () => false);
}
