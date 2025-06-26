export function humanReadableDate(date: Date): string {
  return date.toLocaleString("no-NO", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
