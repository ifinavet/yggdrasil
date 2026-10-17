"use client";
import { useSyncExternalStore } from "react";
import { readEmailLinkToken } from "./email-link-token";

function subscribe(onChange: () => void) {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
}
export function useEmailLinkToken() {
	const hash = useSyncExternalStore(
		subscribe,
		() => window.location.hash,
		() => null,
	);
	return hash === null ? undefined : readEmailLinkToken(hash);
}
