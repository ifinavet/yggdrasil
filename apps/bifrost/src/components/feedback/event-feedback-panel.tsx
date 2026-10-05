"use client";

import type { api } from "@workspace/backend/convex/api";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import { EventFeedbackReport } from "./event-feedback-report";
import { EventFeedbackSettings } from "./event-feedback-settings";
import { FeedbackDeliveryStatus } from "./feedback-delivery-status";
import { FeedbackManualSend } from "./feedback-manual-send";

export function EventFeedbackPanel({
	preloadedEvent,
}: Readonly<{
	preloadedEvent: Preloaded<typeof api.events.queries.getEvent>;
}>) {
	const event = usePreloadedQuery(preloadedEvent);
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<div className="min-w-0">
				<EventFeedbackReport eventId={event._id} />
			</div>
			<div className="flex flex-col gap-4">
				<EventFeedbackSettings eventId={event._id} />
				<FeedbackDeliveryStatus eventId={event._id} />
				<FeedbackManualSend eventId={event._id} />
			</div>
		</div>
	);
}
