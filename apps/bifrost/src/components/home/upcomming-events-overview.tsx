"use client";

import type { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { type Preloaded, usePreloadedQuery } from "convex/react";
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
	return (
		<Link href={`events/${event._id}`}>
			<Card className={className}>
				<CardHeader>
					<CardTitle>{event.title}</CardTitle>
					<CardDescription>
						Registrering åpner: {humanReadableDate(new Date(event.registrationOpens))}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className='line-clamp-2 text-ellipsis'>{event.teaser}</p>
				</CardContent>
				<CardFooter></CardFooter>
			</Card>
		</Link>
	);
}
