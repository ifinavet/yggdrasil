"use client";

import { Button } from "@workspace/ui/components/button";
import { useFeatureEnabled } from "@workspace/ui/components/feature-gate";
import Link from "next/link";

export function FeedbackReportLink({ slug }: Readonly<{ slug: string }>) {
	const enabled = useFeatureEnabled("huginFeedback");
	if (!enabled) return null;
	return (
		<Button asChild variant="outline">
			<Link href={`/events/${slug}/feedback/report`}>Forhåndsvis og del bedriftsrapport</Link>
		</Button>
	);
}
