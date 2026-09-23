export const FEEDBACK_DAY = 86_400_000;
export const REMINDER_DAYS = [3, 7, 11] as const;

const oslo = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/Oslo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
});
function parts(timestamp: number) {
	return Object.fromEntries(
		oslo.formatToParts(timestamp).map(({ type, value }) => [type, Number(value)]),
	);
}

/** Next Oslo calendar morning, including month/year changes and both DST transitions. */
export function feedbackOpensAt(eventStart: number): number {
	const event = parts(eventStart);
	const morning = Date.UTC(event.year, event.month - 1, event.day + 1, 8);
	const local = parts(morning);
	const offset =
		Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) -
		morning;
	return morning - offset;
}

export function feedbackRetentionAt(closedAt: number): number {
	const date = new Date(closedAt);
	const day = date.getUTCDate();
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() + 18);
	const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
	date.setUTCDate(Math.min(day, last));
	return date.getTime();
}

export async function hashFeedbackToken(token: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
