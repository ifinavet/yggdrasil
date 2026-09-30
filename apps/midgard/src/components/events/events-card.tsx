import type { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import EventCard, { type EventCardType } from "./event-card";

type UpcomingEvent = FunctionReturnType<typeof api.events.queries.getUpcoming>[number];

export default function EventsCard({ event }: Readonly<{ event: UpcomingEvent }>) {
	const cardData = {
		companyImage: event.hostingCompanyLogoUrl,
		companyTitle: event.hostingCompanyName,
		title: event.title,
		teaser: event.teaser,
		participationLimit: event.participationLimit,
		eventDate: new Date(event.eventStart),
	} satisfies EventCardType;

	return (
		<Link href={`/events/${event.slug ?? event._id}`} className="h-full">
			<EventCard event={cardData} />
		</Link>
	);
}
