"use client";

import { Button } from "@workspace/ui/components/button";
import { useFeatureEnabled } from "@workspace/ui/components/feature-gate";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

export function FeedbackPreviewLink({ eventId }: Readonly<{ eventId: string }>) {
	const enabled = useFeatureEnabled("huginFeedback");
	if (!enabled) return null;
	return (
		<Button asChild variant="outline">
			<Link href={`/events/${eventId}/feedback`}>
				<MessageSquare className="size-4" /> Innstillinger for tilbakemeldinger
			</Link>
		</Button>
	);
}
