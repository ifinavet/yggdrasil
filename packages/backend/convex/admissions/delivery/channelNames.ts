export function admissionsChannelNames(applicationStartAt: number, periodId: string) {
	const parts = new Intl.DateTimeFormat("en", {
		timeZone: "Europe/Oslo",
		year: "2-digit",
		month: "numeric",
	}).formatToParts(applicationStartAt);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = Number(parts.find((part) => part.type === "month")?.value);
	const name = `${month > 6 ? "h" : "v"}${year}-opptak`;
	return { name, fallbackName: `${name.slice(0, 40)}-${periodId}` };
}
