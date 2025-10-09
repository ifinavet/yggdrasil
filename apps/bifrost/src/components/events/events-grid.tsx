import { URLSearchParams } from "node:url";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import type { Event } from "@/constants/types";
import EventCard from "./event-card";

export default async function EventsGrid() {
	const pathname = (await headers()).get("x-searchParams");
	let searchParams: URLSearchParams | undefined;
	if (pathname) searchParams = new URLSearchParams(pathname);

	const year = searchParams?.get("year") || new Date().getFullYear().toString();
	const semester = searchParams?.get("semester") || (new Date().getMonth() < 7 ? "vår" : "høst");

	const events = await fetchQuery(api.events.getAll, {
		year: Number.parseInt(year),
		semester,
	});

	const publishedEvents = await Promise.all(
		(events?.published || []).map(async (event) => {
			const organizers = await fetchQuery(api.events.getOrganizersByEventId, {
				id: event._id as Id<"events">,
			});
			return { ...event, organizers };
		}),
	);

	const unpublishedEvents = await Promise.all(
		(events?.unpublished || []).map(async (event) => {
			const organizers = await fetchQuery(api.events.getOrganizersByEventId, {
				id: event._id as Id<"events">,
			});
			return { ...event, organizers };
		}),
	);

	return (
		<EventsGridContent publishedEvents={publishedEvents} unpublishedEvents={unpublishedEvents} />
	);
}

function EventsGridContent({
	publishedEvents,
	unpublishedEvents,
}: {
	publishedEvents: Event[];
	unpublishedEvents: Event[];
}) {
	return (
		<div className="grid gap-6">
			{publishedEvents.length > 0 || unpublishedEvents.length > 0 ? (
				<>
					<h2 className="scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0">
						Publiserte arrangementer
					</h2>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{publishedEvents.map((event) => (
							<EventCard
								key={event._id}
								eventId={event._id}
								title={event.title}
								companyName={event.hostingCompanyName}
								date={event.eventStart}
								isPublished={event.published}
								externalUrl={event.externalUrl}
								organizers={event.organizers}
							/>
						))}
					</div>
					<h2 className="scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0">
						Skjulte/Påbegynte arrangementer
					</h2>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{unpublishedEvents.map((event) => (
							<EventCard
								key={event._id}
								eventId={event._id}
								title={event.title}
								companyName={event.hostingCompanyName}
								date={event.eventStart}
								isPublished={event.published}
								externalUrl={event.externalUrl}
								organizers={event.organizers}
							/>
						))}
					</div>
				</>
			) : (
				<p>Vi fant ingen arrangementer</p>
			)}
		</div>
	);
}
