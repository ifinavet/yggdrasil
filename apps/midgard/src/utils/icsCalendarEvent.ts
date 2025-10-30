"use client";

function formatToICSDate(epochMillis: number) {
	return new Date(epochMillis).toISOString().replaceAll(/-|:|\.\d+/g, "");
}
function htmlToPlainText(html: string): string {
	const el = document.createElement("div");
	el.innerHTML = html;
	const text = el.innerText || el.textContent || "";
	return text.replaceAll(/\r\n/g, "\n").replaceAll(/\r/g, "\n").trim();
}

function escapeICSText(text: string): string {
	return text
		.replaceAll(/\\/g, "\\\\")
		.replaceAll(/\r\n|\n|\r/g, "\\n")
		.replaceAll(/,/g, "\\,")
		.replaceAll(/;/g, "\\;");
}

const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

export default function createCalendarEventIcs(
	title: string,
	description: string,
	location: string,
	eventStart: number,
) {
	const startTime = formatToICSDate(eventStart);
	const endTime = formatToICSDate(eventStart + DEFAULT_EVENT_DURATION_MS);
	const uid = `${Date.now()}@ifinavet.no`; // unique ID
	const dtstamp = formatToICSDate(Date.now()); // creation timestamp
	const plainDescription = escapeICSText(htmlToPlainText(description));

	const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//IFI-Navet//NO
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
SUMMARY:${escapeICSText(title)}
DESCRIPTION:${escapeICSText(`${plainDescription}\n\nNB! Slutt tid kan avike fra det som står.`)}
LOCATION:${escapeICSText(location)}
DTSTART:${startTime}
DTEND:${endTime}
END:VEVENT
END:VCALENDAR`;

	const blob = new Blob([icsContent], {
		type: "text/calendar;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);

	const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
	const filename = `${safeTitle || "event"}.ics`;

	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
