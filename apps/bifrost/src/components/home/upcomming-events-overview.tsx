"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Badge } from "@workspace/ui/components/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { humanReadableDate } from "@/utils/utils";

export default function UpcomingEventsOverview({
	preloadedEvents,
}: Readonly<{ preloadedEvents: Preloaded<typeof api.events.getLatest> }>) {
	const events = usePreloadedQuery(preloadedEvents);

	return events.map((event) => <EventCard key={event._id} event={event} className='mb-4' />);
}

export function EventCard({
	event,
	className,
}: Readonly<{ event: Doc<"events">; className?: string }>) {
	const mainOrganizer = useQuery(api.events.getOrganizersByEventId, { id: event._id });

	return (
		<Link href={`events/${event._id}`}>
			<Card className={className}>
				<CardHeader>
					<CardTitle>{event.title}</CardTitle>
					<CardDescription>
						Registration opens: {humanReadableDate(new Date(event.registrationOpens))}
					</CardDescription>
					{(event.registrationOpens < Date.now() && event.eventStart > Date.now() && !event.externalUrl) && (
						<CardAction>
							<Badge>Registrering Åpen</Badge>
						</CardAction>
					)}
				</CardHeader>
				<CardContent>
					<p className='line-clamp-2 text-ellipsis'>{event.teaser}</p>
				</CardContent>
				<CardFooter>
					Hovedansvarlig: <span className="ml-1 font-semibold">{`${mainOrganizer?.find((org) => org.role === "hovedansvarlig")?.name ?? ""}`}</span>
				</CardFooter>
			</Card>
		</Link>
	);
}
