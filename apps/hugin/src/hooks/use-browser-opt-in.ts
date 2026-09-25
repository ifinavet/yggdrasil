"use client";

import { type BrowserOptIn, browserOptInKeys } from "@workspace/shared/feature-flags";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
}

function isOptedIn(optIn: BrowserOptIn) {
	try {
		return localStorage.getItem(browserOptInKeys[optIn]) === "true";
	} catch {
		return false;
	}
}

export function useBrowserOptIn(optIn: BrowserOptIn) {
	return useSyncExternalStore(
		subscribe,
		() => isOptedIn(optIn),
		() => false,
	);
}
