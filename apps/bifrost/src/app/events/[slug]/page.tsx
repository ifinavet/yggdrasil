import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { EventChecklistPanel } from "@/components/events/event-checklist-panel";
import { EventPlanningPanel } from "@/components/events/event-planning-panel";
import { EventReminderBanner } from "@/components/events/event-reminder-banner";
import UpdateEventForm from "./update-event-form";

export default async function EventPage({
	params,
}: Readonly<{
	params: Promise<{ slug: string }>;
}>) {
	const { slug: identifier } = await params;

	const token = await getAuthToken();
	const event = await preloadQuery(api.events.queries.getEvent, { identifier }, { token });

	return (
		<>
			<EventReminderBanner eventId={preloadedQueryResult(event)._id} />
			{!preloadedQueryResult(event).externalEvent && (
				<EventPlanningPanel eventId={preloadedQueryResult(event)._id} />
			)}
			<EventChecklistPanel preloadedEvent={event} />
			<UpdateEventForm preloadedEvent={event} />
		</>
	);
}
