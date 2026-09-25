import { useEffect, useRef } from "react";
import { type StoredDraft, saveDraft } from "@/lib/company-application-storage";

const SAVE_DELAY_MS = 400;

/**
 * Saves the draft a moment after the company stops typing, and at once when the page is left.
 * Nothing is saved once `sent` is true, so a sent application is not brought back as a draft.
 */
export function useDraftAutosave(draft: StoredDraft, sent: { readonly current: boolean }): void {
	const latest = useRef(draft);
	latest.current = draft;

	useEffect(() => {
		if (sent.current) return;
		const timer = window.setTimeout(() => {
			if (!sent.current) saveDraft(draft);
		}, SAVE_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [draft, sent]);

	useEffect(() => {
		const flush = () => {
			if (!sent.current) saveDraft(latest.current);
		};
		window.addEventListener("pagehide", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [sent]);
}
