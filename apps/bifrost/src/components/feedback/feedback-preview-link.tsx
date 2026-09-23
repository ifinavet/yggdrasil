"use client";

import { Button } from "@workspace/ui/components/button";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribeToStorage(onChange: () => void) {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
}
function isFeedbackPreviewEnabled() {
	try {
		return localStorage.getItem("hugin-feedback-preview") === "true";
	} catch {
		return false;
	}
}
export function FeedbackPreviewLink({ eventId }: Readonly<{ eventId: string }>) {
	const enabled = useSyncExternalStore(subscribeToStorage, isFeedbackPreviewEnabled, () => false);
	if (!enabled) return null;
	return (
		<Button asChild variant="link" className="text-foreground">
			<Link href={`/events/${eventId}/feedback`}>
				<MessageSquare className="size-4" /> Tilbakemeldinger
			</Link>
		</Button>
	);
}
