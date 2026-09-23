"use client";

import { Button } from "@workspace/ui/components/button";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useFeedbackPreviewEnabled } from "./use-feedback-preview";

export function FeedbackPreviewLink({ eventId }: Readonly<{ eventId: string }>) {
	const enabled = useFeedbackPreviewEnabled();
	if (!enabled) return null;
	return (
		<Button asChild variant="link" className="text-foreground">
			<Link href={`/events/${eventId}/feedback`}>
				<MessageSquare className="size-4" /> Tilbakemeldinger
			</Link>
		</Button>
	);
}
