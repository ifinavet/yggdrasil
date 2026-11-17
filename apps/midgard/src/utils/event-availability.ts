import { humanReadableDateTime } from "@workspace/shared/time";
import { formatDistanceStrict } from "date-fns";
import { nb } from "date-fns/locale";
import type { EventWithParticipationCount } from "@/constants/event-types";

export function spotsLabel(availableSpots: number): string {
	return `${availableSpots} ${availableSpots === 1 ? "plass" : "plasser"} igjen`;
}

export function countdownLabel(eventStart: number, now: number): string | null {
	if (eventStart <= now) return null;
	return formatDistanceStrict(eventStart, now, { addSuffix: true, locale: nb });
}

/**
 * The status banner of an event card: whether to show it, its text and its colour.
 *
 * @param event - The event's times, phase and registrations.
 * @param now - The current time, for the day-based labels.
 *
 * @returns The banner's visibility, message and colour classes.
 */
export function registrationStatus(
	event: Pick<
		EventWithParticipationCount,
		| "registrationOpens"
		| "eventStart"
		| "registrationPhase"
		| "participationCount"
		| "participationLimit"
	>,
	now: Date,
) {
	const registrationOpensDate = new Date(event.registrationOpens);
	const eventStartDate = new Date(event.eventStart);

	const participants = event.participationCount;
	const participantsLimit = event.participationLimit;

	const registrationHasOpened = event.registrationPhase !== "upcoming";

	const eventStartPlusOneDay = new Date(eventStartDate);
	eventStartPlusOneDay.setDate(eventStartPlusOneDay.getDate() + 1);
	eventStartPlusOneDay.setHours(0, 0, 0, 0);

	const showBanner = event.registrationPhase === "upcoming" || event.registrationPhase === "open";
	const isDayAfterEvent = now >= eventStartPlusOneDay;

	const todayStart = new Date(now);
	todayStart.setHours(0, 0, 0, 0);
	const tomorrowStart = new Date(todayStart);
	tomorrowStart.setDate(tomorrowStart.getDate() + 1);

	const registrationOpenToday =
		registrationHasOpened &&
		registrationOpensDate >= todayStart &&
		registrationOpensDate < tomorrowStart;

	const statusMessage = !registrationHasOpened
		? `Påmeldingen åpner ${humanReadableDateTime(registrationOpensDate)}`
		: participants >= participantsLimit
			? "Påmeldingen er full, sett deg på venteliste!"
			: registrationOpenToday
				? "Påmeldingen er åpen"
				: "Det er fortsatt ledige plasser";

	return {
		showBanner,
		statusMessage,
		cardColor: isDayAfterEvent
			? "border-zinc-400 bg-zinc-400"
			: registrationHasOpened
				? "border-emerald-700 bg-emerald-700"
				: "border-zinc-400 bg-zinc-400",
	};
}
