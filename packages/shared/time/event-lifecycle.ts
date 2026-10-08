import { DAY_MS } from "./constants";
import { osloDateTimeToEpoch, osloToday } from "./semester";

export const EVENT_PLANNING = {
	channelDaysBefore: 35,
	companyContactDaysBefore: 28,
	archiveDaysAfter: 7,
	practicalDaysBefore: 2,
	expensesDaysAfter: 1,
	promotionDaysBefore: 1,
	textDaysBefore: 14,
	checklistDaysBefore: 7,
	approvalDaysAfter: 3,
	attendanceHoursAfterFeedback: [-1, 4],
	attendanceDaysAfterFeedback: [1, 2],
};

/** Calendar days before the event, at 09:00 Oslo, including across DST changes. */
export function eventPlanningAt(eventStart: number, daysBefore: number): number {
	const day = new Date(Date.parse(osloToday(eventStart)) - daysBefore * DAY_MS)
		.toISOString()
		.slice(0, 10);
	return osloDateTimeToEpoch(day, "09:00");
}
