"use client";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { useFeatureEnabled } from "@workspace/ui/hooks/use-feature-enabled";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EventFeedbackReport } from "./event-feedback-report";

type Props = Readonly<{
	preloadedEvent: Preloaded<typeof api.events.queries.getEvent>;
	slug: string;
}>;
export function ReportFeedbackBanner({ preloadedEvent, slug }: Props) {
	const event = usePreloadedQuery(preloadedEvent);
	const enabled = useFeatureEnabled("huginFeedback");
	const data = useQuery(
		api.feedback.reports.queries.getEventReport,
		enabled ? { eventId: event._id } : "skip",
	);
	if (!data?.enabled || data.campaignStatus !== "closed") return null;
	return (
		<div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/40 p-4">
			<p className="font-medium">Svarfristen er utløpt</p>
			<Button asChild>
				<Link href={`/events/${slug}/feedback/report`}>Forhåndsvis rapport</Link>
			</Button>
		</div>
	);
}
export function ReportFeedbackStatistics({
	preloadedEvent,
	children,
}: Omit<Props, "slug"> & { children: ReactNode }) {
	const event = usePreloadedQuery(preloadedEvent);
	return <EventFeedbackReport eventId={event._id} summary fallback={children} />;
}
