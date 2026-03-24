import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";

function escapeIcsText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

function formatIcsDate(timestamp: number): string {
	const d = new Date(timestamp);
	return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET() {
	const events = await fetchQuery(api.events.getUpcoming, { n: 100 });

	const now = formatIcsDate(Date.now());
	const calendarLines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Yggdrasil//Events//NO",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:Arrangementer",
	];

	for (const event of events) {
		const dtStart = formatIcsDate(event.eventStart);
		// Default to 2 hours duration if no end time
		const dtEnd = formatIcsDate(event.eventStart + 2 * 60 * 60 * 1000);
		const uid = `${event._id}@yggdrasil`;

		calendarLines.push(
			"BEGIN:VEVENT",
			`UID:${uid}`,
			`DTSTAMP:${now}`,
			`DTSTART:${dtStart}`,
			`DTEND:${dtEnd}`,
			`SUMMARY:${escapeIcsText(event.title)}`,
			`DESCRIPTION:${escapeIcsText(event.teaser)}`,
			`LOCATION:${escapeIcsText(event.location)}`,
			"END:VEVENT",
		);
	}

	calendarLines.push("END:VCALENDAR");

	const body = calendarLines.join("\r\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Content-Disposition": 'attachment; filename="events.ics"',
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
		},
	});
}
