import { oreToKroner } from "@workspace/shared/products";
import { STUDENT_CAP } from "@workspace/shared/semester/application";
import type { EventType } from "@workspace/shared/semester/labels";
import { formatNok } from "@workspace/shared/semester/prices";
import { capitalize } from "@workspace/shared/utils";
import { differenceInCalendarMonths, format, parse, startOfMonth } from "date-fns";
import { nb } from "date-fns/locale";
import { COMPANY_APPLICATION_COPY as COPY } from "./company-application-questions";

// Date labels for the application form. Semester days are plain "YYYY-MM-DD" calendar days, so
// they are parsed and formatted in one zone and no time-of-day or offset is involved.

const ISO_DAY = "yyyy-MM-dd";

/** A semester day as a local date, for the calendar. */
export function calendarDay(date: string): Date {
	return parse(date, ISO_DAY, new Date());
}

/** A local date from the calendar as a semester day. */
export function semesterDay(day: Date): string {
	return format(day, ISO_DAY);
}

function withoutDot(text: string): string {
	return text.replace(/\.$/, "");
}

/** The months a calendar of the open dates shows: the first one, and how many in a row. */
export function calendarMonths(dates: readonly string[]): { first: Date; count: number } | null {
	// "YYYY-MM-DD" days sort as text.
	const sorted = [...dates].sort((a, b) => a.localeCompare(b));
	const [earliest, latest] = [sorted[0], sorted.at(-1)];
	if (!earliest || !latest) return null;
	const first = startOfMonth(calendarDay(earliest));
	return { first, count: differenceInCalendarMonths(calendarDay(latest), first) + 1 };
}

/** «Tir» and «26.», the two parts of a date cell. */
export function dateCellParts(date: string): { weekday: string; day: string } {
	const day = calendarDay(date);
	return {
		weekday: capitalize(withoutDot(format(day, "EEE", { locale: nb }))),
		day: format(day, "d.", { locale: nb }),
	};
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
	const sorted = [...dates].sort((a, b) => a.localeCompare(b));
	const parts = sorted.map((date, index) => {
		const day = calendarDay(date);
		const next = sorted[index + 1];
		const lastInMonth = next?.slice(0, 7) !== date.slice(0, 7);
		return lastInMonth
			? `${format(day, "d.")} ${withoutDot(format(day, "MMM", { locale: nb }))}`
			: format(day, "d.");
	});

	if (parts.length <= 1) return parts.join("");
	return `${parts.slice(0, -1).join(", ")} og ${parts.at(-1)}`;
}

/** «25–40» or «40». */
export function studentRange(min: number, max: number): string {
	return min === max ? String(max) : `${min}–${max}`;
}

/** The invoice answer on the receipt: the email, the free text and EHF, each on its own line. */
export function billingLines(billing: {
	email?: string;
	details?: string;
	ehfInvoice?: boolean;
}): string[] {
	return [
		billing.email,
		billing.details,
		billing.ehfInvoice ? "Faktura som EHF" : undefined,
	].filter((line): line is string => Boolean(line));
}

export function eventTypeDescription(type: EventType, priceOre: number | undefined): string {
	const cap = STUDENT_CAP[type];
	const size = cap === null ? COPY.eventType.uncapped : COPY.eventType.capped(cap);
	if (priceOre === undefined) return size;
	return `${size} · ${COPY.eventType.price(formatNok(oreToKroner(priceOre)))}`;
}
