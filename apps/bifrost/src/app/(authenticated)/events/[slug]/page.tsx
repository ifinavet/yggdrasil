import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { preloadQuery } from "convex/nextjs";
import UpdateEventForm from "./update-event-form";

export default async function EventPage({ params }: { params: Promise<{ slug: Id<"events"> }> }) {
	const { slug: eventId } = await params;

	const event = await preloadQuery(api.events.getById, { id: eventId });

	return <UpdateEventForm preloadedEvent={event} />;
}
