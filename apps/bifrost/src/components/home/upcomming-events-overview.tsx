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
	const events = usePreloadedQuery(preloadedEvents)
		.filter((m) => !m.externalUrl)
		.sort((a, b) => a.eventStart - b.eventStart);

	const now = new Date();
	const startOfWeek = startOfCurrentWeek(now);
	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(endOfWeek.getDate() + 7);

	const thisWeek: Doc<"events">[] = [];
	const upcoming: Doc<"events">[] = [];

	for (const ev of events) {
		const start = new Date(ev.eventStart);
		if (start >= startOfWeek && start < endOfWeek) {
			thisWeek.push(ev);
		} else if (start >= endOfWeek) {
			upcoming.push(ev);
		}
	}

	if (thisWeek.length === 0 && upcoming.length === 0) {
		return <p className="text-muted-foreground">Ingen kommende arrangementer.</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			{thisWeek.length > 0 && (
				<section>
					<h3 className="mb-2 font-semibold text-lg">Denne uken</h3>
					<div>
						{thisWeek.map((event) => (
							<EventCard key={event._id} event={event} className="mb-4" />
						))}
					</div>
				</section>
			)}
			{upcoming.length > 0 && (
				<section>
					<h3 className="mb-2 font-semibold text-lg">Kommende</h3>
					<div>
						{upcoming.map((event) => (
							<EventCard key={event._id} event={event} className="mb-4" />
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function startOfCurrentWeek(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay();
	const isoDay = day === 0 ? 7 : day;
	d.setDate(d.getDate() - (isoDay - 1));
	return d;
}

export function EventCard({
	event,
	className,
}: Readonly<{ event: Doc<"events">; className?: string }>) {
	const mainOrganizer = useQuery(api.events.getOrganizersByEventId, {
		id: event._id,
	});

	return (
		<Link href={`events/${event._id}`}>
			<Card className={className}>
				<CardHeader>
					<CardTitle>{event.title}</CardTitle>
					<CardDescription>
						Registrering åpner: {humanReadableDate(new Date(event.registrationOpens))}
					</CardDescription>
					{event.registrationOpens < Date.now() &&
						event.eventStart > Date.now() &&
						!event.externalUrl && (
							<CardAction>
								<Badge>Registrering Åpen</Badge>
							</CardAction>
						)}
				</CardHeader>
				<CardContent>
					<p className="line-clamp-2 text-ellipsis">{event.teaser}</p>
				</CardContent>
				<CardFooter>
					Hovedansvarlig:{" "}
					<span className="ml-1 font-semibold">
						{mainOrganizer?.find((org) => org.role === "hovedansvarlig")?.name ?? ""}
					</span>
				</CardFooter>
			</Card>
		</Link>
	);
}
