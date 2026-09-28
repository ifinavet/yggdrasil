"use client";

import type { Doc } from "@workspace/backend/convex/dataModel";
import { MIDGARD_URL } from "@workspace/shared/constants/urls";
import { Button } from "@workspace/ui/components/button";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
import { type CalendarEvent, googleCalendarUrl, outlookCalendarUrl } from "@/utils/calendar-links";
import createCalendarEventIcs from "@/utils/icsCalendarEvent";

type Provider = "google" | "apple" | "outlook";

export default function CalendarLinks({
	event,
	source,
}: Readonly<{
	event: Doc<"events">;
	source: "registration-toast" | "edit-registration";
}>) {
	const postHog = usePostHog();

	const calendarEvent: CalendarEvent = {
		title: event.title,
		location: event.location,
		eventStart: event.eventStart,
		url: `${MIDGARD_URL}/events/${event.slug ?? event._id}`,
	};

	const track = (provider: Provider) =>
		postHog.capture("midgard_added-event-to-calendar", {
			site: "midgard",
			eventId: event._id,
			eventTitle: event.title,
			source,
			provider,
		});

	return (
		<div className="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" asChild>
				<a
					href={googleCalendarUrl(calendarEvent)}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() => track("google")}
				>
					<Image src="/calendar-logos/google-calendar.svg" alt="" width={16} height={16} />
					Google
				</a>
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => {
					createCalendarEventIcs(event.title, event.description, event.location, event.eventStart);
					track("apple");
				}}
			>
				<Image
					src="/calendar-logos/apple.svg"
					alt=""
					width={16}
					height={16}
					className="dark:invert"
				/>
				Apple
			</Button>
			<Button variant="outline" size="sm" asChild>
				<a
					href={outlookCalendarUrl(calendarEvent)}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() => track("outlook")}
				>
					<Image src="/calendar-logos/outlook.svg" alt="" width={16} height={16} />
					Outlook
				</a>
			</Button>
		</div>
	);
}
