import { osloToday, termOfDay } from "../time";

export const SYSTEM_ALERTS_CHANNEL = "C0C5L3JPSE7";

export function admissionsChannelNames(applicationStartAt: number, periodId: string) {
	const { term, year } = termOfDay(osloToday(applicationStartAt));
	const name = `${term === "autumn" ? "h" : "v"}${String(year).slice(-2)}-opptak`;
	return { name, fallbackName: `${name}-${periodId}` };
}
