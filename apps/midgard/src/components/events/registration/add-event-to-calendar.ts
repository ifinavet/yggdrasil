import type { Doc } from "@workspace/backend/convex/dataModel";
import type { PostHog } from "posthog-js";
import createCalendarEventIcs from "@/utils/icsCalendarEvent";

export function addEventToCalendar(
	event: Doc<"events">,
	postHog: PostHog,
	source: "registration-toast" | "edit-registration",
) {
	createCalendarEventIcs(event.title, event.description, event.location, event.eventStart);

	postHog.capture("midgard_added-event-to-calendar", {
		site: "midgard",
		eventId: event._id,
		eventTitle: event.title,
		source,
	});
}
