import type { api } from "@workspace/backend/convex/api";
import type { FunctionReturnType } from "convex/server";
import { monthLabel, osloDateParts, shortDate } from "./dates";

export type OverviewEvent = FunctionReturnType<typeof api.events.overview.getOverview>[number];

export type FeedbackStatus = NonNullable<OverviewEvent["feedbackStatus"]>;

export type MonthGroup = { key: string; label: string; events: OverviewEvent[] };

export type Registrations =
	| { kind: "note"; text: string }
	| { kind: "count"; registered: number; limit: number; waitlist: number };

export function eventHref(event: Pick<OverviewEvent, "_id" | "slug">): string {
	return `/events/${event.slug ?? event._id}`;
}

export function matchesSearch(
	event: Pick<OverviewEvent, "title" | "companyName">,
	search: string,
): boolean {
	const needle = search.trim().toLocaleLowerCase("nb");
	if (!needle) return true;
	return [event.title, event.companyName].some((text) =>
		text.toLocaleLowerCase("nb").includes(needle),
	);
}

export function splitIntoSections(events: OverviewEvent[], now: number, search = "") {
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
		const { year, monthNumber } = osloDateParts(event.eventStart);
		const key = `${year}-${monthNumber}`;
		const current = groups.at(-1);
		if (current?.key === key) {
			current.events.push(event);
		} else {
			groups.push({ key, label: monthLabel(event.eventStart), events: [event] });
		}
	}
	return groups;
}

export function registrations(event: OverviewEvent, now: number): Registrations {
	if (!event.published) return { kind: "note", text: "Upublisert" };
	if (event.externalEvent) return { kind: "note", text: "Ekstern påmelding" };
	if (event.registrationOpens > now) {
		return { kind: "note", text: `Åpner ${shortDate(event.registrationOpens)}` };
	}
	return {
		kind: "count",
		registered: event.registeredCount,
		limit: event.participationLimit,
		waitlist: event.waitlistCount,
	};
}
