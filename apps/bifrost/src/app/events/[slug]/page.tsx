import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { preloadQuery } from "convex/nextjs";
import UpdateEventForm from "./update-event-form";

export default async function EventPage({
	params,
}: Readonly<{
	params: Promise<{ slug: Id<"events"> }>;
}>) {
	const { slug: identifier } = await params;

	const event = await preloadQuery(api.events.getEvent, { identifier });

	return <UpdateEventForm preloadedEvent={event} />;
}
