import { api } from "@workspace/backend/convex/api";
import {
	EVENT_SEMESTER_LABELS,
	eventSemesterOf,
	MONTH_NAMES,
	osloMonthName,
} from "@workspace/shared/time";
import { placeholderKeys } from "@workspace/shared/utils";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import EventsList from "@/components/events/events-list";
import MonthSelector from "@/components/events/month-selector";
import EventCardSkeleton from "@/components/loaders/event-card-skeleton";
import TitleSkeleton from "@/components/loaders/title-skeleton";
import { nextEventMonth, splitUpcomingPast } from "@/lib/events-feed";

export const metadata: Metadata = {
	title: "Arrangementer",
};

export default function EventsPage() {
	return (
		<Suspense fallback={<EventsFallback />}>
			<Events />
		</Suspense>
	);
}

function EventsFallback() {
	return (
		<div className="grid gap-4">
			<TitleSkeleton />
			<div className="mx-6 flex max-w-7xl flex-col gap-6 md:mx-auto md:w-3/5">
				{placeholderKeys("event-card", 3).map((key) => (
					<EventCardSkeleton key={key} />
				))}
			</div>
		</div>
	);
}

async function Events() {
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

	const currentMonth = nextEventMonth(events, now) ?? osloMonthName(now);
	const selectedMonth = searchParams?.get("month")?.toLowerCase();

	const activeMonth =
		selectedMonth && months.includes(selectedMonth)
			? selectedMonth
			: months.includes(currentMonth)
				? currentMonth
				: (months[0] ?? currentMonth);

	const { upcoming, past } = splitUpcomingPast(events[activeMonth] ?? [], now);

	return (
		<div className="relative h-full">
			<div
				className="mask-t-from-85% pointer-events-none absolute inset-0 bg-[url(/Ns.svg)] bg-center bg-cover dark:opacity-30"
				aria-hidden="true"
			/>
			<div className="relative z-10 grid gap-4">
				<h1 className="scroll-m-20 text-balance text-center font-extrabold text-5xl text-primary tracking-tight dark:text-primary-foreground">
					Arrangementer
				</h1>
				<h3 className="scroll-m-20 text-center font-semibold text-2xl text-zinc-700 tracking-tight dark:text-zinc-300">
					{EVENT_SEMESTER_LABELS[semester]} {year}
				</h3>
			</div>

			<div className="relative z-10">
				<MonthSelector activeMonth={activeMonth} months={months} />
			</div>
			<div className="relative z-10 py-4">
				<EventsList upcoming={upcoming} past={past} />
			</div>
		</div>
	);
}
