import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import EventCard, { type EventCardType } from "./event-card";

export default async function EventsCard({
	event,
}: Readonly<{ event: Doc<"events"> }>) {
	const company = await fetchQuery(api.companies.getById, {
		id: event.hostingCompany,
	});

	const cardData = {
		companyImage: company.imageUrl,
		companyTitle: company.name,
		title: event.title,
		teaser: event.teaser,
		participationLimit: event.participationLimit,
		eventDate: new Date(event.eventStart),
	} satisfies EventCardType;

	return (
		<Link href={`/events/${event._id}`} className="h-full">
			<EventCard event={cardData} />
		</Link>
	);
}
