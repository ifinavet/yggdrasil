import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { EventChecklistPanel } from "@/components/events/event-checklist-panel";
import { EventReminderSettings } from "@/components/events/event-reminder-settings";
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
			<EventChecklistPanel preloadedEvent={event} />
			<UpdateEventForm preloadedEvent={event} />
			<EventReminderSettings eventId={preloadedQueryResult(event)._id} />
		</>
	);
}
