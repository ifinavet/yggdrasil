import type { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import type { FunctionReturnType } from "convex/server";

export type OverviewEvent = FunctionReturnType<typeof api.events.queries.getAll>[number];

export type FeedbackStatus = NonNullable<OverviewEvent["feedbackStatus"]>;

export type MonthGroup = { key: string; label: string; events: OverviewEvent[] };

export type Registrations =
	| { kind: "note"; text: string }
	| { kind: "count"; registered: number; limit: number; waitlist: number };

export function eventHref(event: Pick<OverviewEvent, "_id" | "slug">): string {
	return `/events/${event.slug ?? event._id}`;
}

export function matchesSearch(
	event: Pick<OverviewEvent, "title" | "companyName" | "leadName">,
	search: string,
): boolean {
	const needle = search.trim().toLocaleLowerCase("nb");
	if (!needle) return true;
	return [event.title, event.companyName, event.leadName].some((text) =>
		text?.toLocaleLowerCase("nb").includes(needle),
	);
}

export type EventSections = {
	mine: OverviewEvent[];
	upcoming: OverviewEvent[];
	past: OverviewEvent[];
	unpublished: OverviewEvent[];
};

export function splitIntoSections(
	events: OverviewEvent[],
	now: number,
	search = "",
): EventSections {
	const isPast = (event: OverviewEvent) => event.eventStart < now;
	const matching = events.filter((event) => matchesSearch(event, search));
	const published = matching.filter((event) => event.published);

	return {
		mine: events.filter(
			(event) =>
				event.published &&
				event.myRole !== null &&
				(!isPast(event) || event.feedbackStatus === "draft"),
		),
		upcoming: published.filter((event) => !isPast(event)),
		past: published.filter(isPast).reverse(),
		unpublished: matching.filter((event) => !event.published),
	};
}

export function groupByMonth(events: OverviewEvent[]): MonthGroup[] {
	const groups: MonthGroup[] = [];
	for (const event of events) {
		const key = formatOsloDate(event.eventStart, DATE_PATTERNS.monthKey);
		const current = groups.at(-1);
		if (current?.key === key) {
			current.events.push(event);
		} else {
			groups.push({
				key,
				label: formatOsloDate(event.eventStart, DATE_PATTERNS.month),
				events: [event],
			});
		}
	}
	return groups;
}

export function registrations(event: OverviewEvent, now: number): Registrations {
	if (!event.published) return { kind: "note", text: "Upublisert" };
	if (event.externalEvent) return { kind: "note", text: "Ekstern påmelding" };
	if (event.registrationOpens > now) {
		return {
			kind: "note",
			text: `Åpner ${formatOsloDate(event.registrationOpens, DATE_PATTERNS.shortDate)}`,
		};
	}
	return {
		kind: "count",
		registered: event.registeredCount,
		limit: event.participationLimit,
		waitlist: event.waitlistCount,
	};
}
