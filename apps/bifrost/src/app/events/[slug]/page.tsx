import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { preloadQuery } from "convex/nextjs";
import UpdateEventForm from "./update-event-form";

export default async function EventPage({
	params,
}: Readonly<{
	params: Promise<{ slug: string }>;
}>) {
	const { slug: identifier } = await params;

	const token = await getAuthToken();
	const event = await preloadQuery(api.events.queries.getEvent, { identifier }, { token });

	return <UpdateEventForm preloadedEvent={event} />;
}
