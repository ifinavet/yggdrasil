"use client";

import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { useFeedbackPreviewEnabled } from "./use-feedback-preview";

export function FeedbackReportLink({ slug }: Readonly<{ slug: string }>) {
	const enabled = useFeedbackPreviewEnabled();
	if (!enabled) return null;
	return <Button asChild variant="outline"><Link href={`/events/${slug}/feedback/report`}>Se rapport</Link></Button>;
}
