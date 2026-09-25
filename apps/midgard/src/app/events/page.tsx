import { api } from "@workspace/backend/convex/api";
import {
	EVENT_SEMESTER_LABELS,
	eventSemesterOf,
	MONTH_NAMES,
	osloMonthName,
} from "@workspace/shared/time";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import EventsList from "@/components/events/events-list";
import MonthSelector from "@/components/events/month-selector";

export const metadata: Metadata = {
	title: "Arrangementer",
};

export default async function EventsPage() {
	const pathname = (await headers()).get("x-searchParams");
	let searchParams: URLSearchParams | undefined;
	if (pathname) searchParams = new URLSearchParams(pathname);
	const isExternalEvents = searchParams?.get("external") === "true";

	const events = await fetchQuery(api.events.queries.getCurrentSemester, {
		isExternal: isExternalEvents,
	});
	const now = Date.now();
	const { semester, year } = eventSemesterOf(now);

	const months = Object.keys(events).sort(
		(a, b) => MONTH_NAMES.indexOf(a.toLowerCase()) - MONTH_NAMES.indexOf(b.toLowerCase()),
	);

	const currentMonth = osloMonthName(now);
	const selectedMonth = searchParams?.get("month")?.toLowerCase();

	const activeMonth =
		selectedMonth && months.includes(selectedMonth)
			? selectedMonth
			: months.includes(currentMonth)
				? currentMonth
				: (months[0] ?? currentMonth);

	const activeMonthEvents = events[activeMonth] ?? [];

	return (
		<>
			<div className="grid gap-4">
				<h1 className="scroll-m-20 text-balance text-center font-extrabold text-5xl text-primary tracking-tight dark:text-primary-foreground">
					Arrangementer
				</h1>
				<h3 className="scroll-m-20 text-center font-semibold text-2xl text-zinc-700 tracking-tight dark:text-zinc-300">
					{EVENT_SEMESTER_LABELS[semester]} {year}
				</h3>
			</div>

			<MonthSelector activeMonth={activeMonth} months={months} />
			<div className="relative h-full">
				<div
					className="pointer-events-none absolute inset-0 bg-[url(/Ns.svg)] bg-center bg-cover dark:opacity-30"
					aria-hidden="true"
				/>
				<div className="relative z-10 py-4">
					<EventsList events={activeMonthEvents} />
				</div>
			</div>
		</>
	);
}
