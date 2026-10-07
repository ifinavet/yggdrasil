import { semesterName } from "@workspace/shared/semester/labels";
import { formatSemesterDay, osloToday, termOfDay } from "@workspace/shared/time";
import { dateCellParts, dayAndMonth } from "./company-application-format";

// Date and semester labels for the offer page.

const OSLO_TIME = new Intl.DateTimeFormat("nb-NO", {
	timeZone: "Europe/Oslo",
	hour: "2-digit",
	minute: "2-digit",
});

/** «Tirsdag 9. februar 2027», for the offered day as a heading. */
export function offerDayHeading(date: string): string {
	const long = formatSemesterDay(date, "long");
	return long.charAt(0).toUpperCase() + long.slice(1);
}

/** «Tir 2. februar», for a date the company can pick instead. */
export function pickableDayLabel(date: string): string {
	return `${dateCellParts(date).weekday} ${dayAndMonth(date)}`;
}

/** «tir 2. februar», for a date inside a sentence. */
export function dayInSentence(date: string): string {
	return pickableDayLabel(date).toLowerCase();
}

/** «18. desember», the Oslo calendar day of a moment. */
export function osloDayMonth(epoch: number): string {
	return dayAndMonth(osloToday(epoch));
}

/** «5. desember kl. 08:31», a moment in Oslo time. */
export function osloDayAndTime(epoch: number): string {
	return `${osloDayMonth(epoch)} kl. ${OSLO_TIME.format(epoch)}`;
}

/** «Våren 2027», the semester the offered day belongs to. */
export function offerSemesterName(date: string, { inSentence = false } = {}): string {
	const { term, year } = termOfDay(date);
	return semesterName(term, year, { inSentence });
}
