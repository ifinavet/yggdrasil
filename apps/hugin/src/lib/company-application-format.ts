import { format, parse } from "date-fns";
import { nb } from "date-fns/locale";

// Date labels for the application form. Semester days are plain "YYYY-MM-DD" calendar days, so
// they are parsed and formatted in one zone and no time-of-day or offset is involved.

function calendarDay(date: string): Date {
	return parse(date, "yyyy-MM-dd", new Date());
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function withoutDot(text: string): string {
	return text.replace(/\.$/, "");
}

export type DateWeek = { week: string; days: string[] };
export type DateMonth = { key: string; label: string; weeks: DateWeek[] };

/** Open dates grouped by month, then by ISO week (as Norwegian calendars number them). */
export function groupDatesByMonth(dates: readonly string[]): DateMonth[] {
	const months: DateMonth[] = [];

	for (const date of [...dates].sort()) {
		const day = calendarDay(date);
		const key = date.slice(0, 7);
		let month = months.at(-1);
		if (month?.key !== key) {
			month = { key, label: capitalize(format(day, "LLLL", { locale: nb })), weeks: [] };
			months.push(month);
		}

		const week = format(day, "I");
		let group = month.weeks.at(-1);
		if (group?.week !== week) {
			group = { week, days: [] };
			month.weeks.push(group);
		}
		group.days.push(date);
	}

	return months;
}

/** «Tir» and «26.», the two parts of a date cell. */
export function dateCellParts(date: string): { weekday: string; day: string } {
	const day = calendarDay(date);
	return {
		weekday: capitalize(withoutDot(format(day, "EEE", { locale: nb }))),
		day: format(day, "d.", { locale: nb }),
	};
}

/** Whether the date is a Tuesday, so it goes in the left column of the week. */
export function isTuesdayDate(date: string): boolean {
	return calendarDay(date).getDay() === 2;
}

/** «4. desember», a deadline in a sentence. */
export function dayAndMonth(date: string): string {
	return format(calendarDay(date), "d. MMMM", { locale: nb });
}

/** «15. oktober 2026», a date that stands on its own, like the deadline at the top of the form. */
export function fullDate(date: string): string {
	return format(calendarDay(date), "d. MMMM yyyy", { locale: nb });
}

/** «28. jan, 2., 4. og 9. feb», a short list of chosen days for the receipt. */
export function compactDateList(dates: readonly string[]): string {
	const sorted = [...dates].sort();
	const parts = sorted.map((date, index) => {
		const day = calendarDay(date);
		const next = sorted[index + 1];
		const lastInMonth = next === undefined || next.slice(0, 7) !== date.slice(0, 7);
		return lastInMonth
			? `${format(day, "d.")} ${withoutDot(format(day, "MMM", { locale: nb }))}`
			: format(day, "d.");
	});

	if (parts.length <= 1) return parts.join("");
	return `${parts.slice(0, -1).join(", ")} og ${parts.at(-1)}`;
}

/** «924 773 189», an organization number the way brreg writes it. */
export function formatOrgNumber(orgNumber: string): string {
	return orgNumber.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}

/** «25–40» or «40». */
export function studentRange(min: number, max: number): string {
	return min === max ? String(max) : `${min}–${max}`;
}

const LOWERCASE_PLACE_WORDS = new Set(["i", "på", "og"]);

/** A place name from Enhetsregisteret («MO I RANA») the way people write it («Mo i Rana»). */
export function placeName(city: string): string {
	return city
		.toLocaleLowerCase("nb")
		.split(" ")
		.map((word, index) =>
			index > 0 && LOWERCASE_PLACE_WORDS.has(word)
				? word
				: word.replace(
						/(^|-)(\p{L})/gu,
						(_, dash: string, letter: string) => dash + letter.toLocaleUpperCase("nb"),
					),
		)
		.join(" ");
}

/** The invoice answer on the receipt: the email and the free text, each on its own line. */
export function billingLines(billing: { email?: string; details?: string }): string[] {
	return [billing.email, billing.details].filter((line): line is string => Boolean(line));
}
