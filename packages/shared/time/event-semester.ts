import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { DATE_PATTERNS, OSLO_TIME_ZONE } from "./constants";
import { osloToday } from "./semester";

const AUTUMN_FIRST_MONTH = 7;

export const EVENT_SEMESTERS = ["vår", "høst"] as const;
export type EventSemester = (typeof EVENT_SEMESTERS)[number];

export const EVENT_SEMESTER_LABELS: Record<EventSemester, string> = {
	vår: "Vår",
	høst: "Høst",
};

export const MONTH_NAMES = Array.from({ length: 12 }, (_, month) =>
	format(new Date(2000, month, 1), DATE_PATTERNS.month, { locale: nb }),
);

export function isEventSemester(value: string | null | undefined): value is EventSemester {
	return EVENT_SEMESTERS.includes(value as EventSemester);
}

function osloYearAndMonth(timestamp: number) {
	const [year, month] = osloToday(timestamp).split("-").map(Number) as [number, number];
	return { year, monthIndex: month - 1 };
}

export function osloMonthName(timestamp: number): string {
	return MONTH_NAMES[osloYearAndMonth(timestamp).monthIndex] as string;
}

export function eventSemesterOf(timestamp: number): { semester: EventSemester; year: number } {
	const { year, monthIndex } = osloYearAndMonth(timestamp);
	return { semester: monthIndex < AUTUMN_FIRST_MONTH ? "vår" : "høst", year };
}

export function eventSemesterRange(
	semester: EventSemester,
	year: number,
): { start: number; end: number } {
	const [startMonth, endYear, endMonth] =
		semester === "vår" ? [0, year, AUTUMN_FIRST_MONTH] : [AUTUMN_FIRST_MONTH, year + 1, 0];
	return {
		start: new TZDate(year, startMonth, 1, OSLO_TIME_ZONE).getTime(),
		end: new TZDate(endYear, endMonth, 1, OSLO_TIME_ZONE).getTime(),
	};
}
