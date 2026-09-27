import { TZDate } from "@date-fns/tz";
import { addMonths, set } from "date-fns";
import { OSLO_TIME_ZONE } from "./constants";

const INVOICE_HOUR_OSLO = 6;

export function invoiceDueAt(serviceAt: number): number {
	return set(addMonths(new TZDate(serviceAt, OSLO_TIME_ZONE), 1), {
		hours: INVOICE_HOUR_OSLO,
		minutes: 0,
		seconds: 0,
		milliseconds: 0,
	}).getTime();
}
