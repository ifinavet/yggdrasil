"use client";

import { parseSeenSteps } from "@workspace/ui/lib/seen-steps";
import { useCallback, useSyncExternalStore } from "react";

const changeEvent = "seen-steps-change";
const snapshots = new Map<string, { raw: string | null; steps: readonly string[] }>();

function subscribe(onChange: () => void) {
	window.addEventListener("storage", onChange);
	window.addEventListener(changeEvent, onChange);
	return () => {
		window.removeEventListener("storage", onChange);
		window.removeEventListener(changeEvent, onChange);
	};
}

function readRaw(storageKey: string) {
	try {
		return localStorage.getItem(storageKey);
	} catch {
		return null;
	}
}

function readSeen(storageKey: string) {
	const raw = readRaw(storageKey);
	const cached = snapshots.get(storageKey);
	if (cached?.raw === raw) return cached.steps;
	const steps = parseSeenSteps(raw);
	snapshots.set(storageKey, { raw, steps });
	return steps;
}

function write(storageKey: string, steps: readonly string[]) {
	try {
		if (steps.length) localStorage.setItem(storageKey, JSON.stringify(steps));
		else localStorage.removeItem(storageKey);
	} catch {
		return;
	}
	window.dispatchEvent(new Event(changeEvent));
}

export function useSeenSteps(storageKey: string) {
	const seen = useSyncExternalStore<readonly string[] | null>(
		subscribe,
		() => readSeen(storageKey),
		() => null,
	);
	const markSeen = useCallback(
		(step: string) => {
			const current = readSeen(storageKey);
			if (!current.includes(step)) write(storageKey, [...current, step]);
		},
		[storageKey],
	);
	const reset = useCallback(() => write(storageKey, []), [storageKey]);
	return { seen, markSeen, reset };
}
