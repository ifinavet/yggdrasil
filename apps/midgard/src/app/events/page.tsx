import { api } from "@workspace/backend/convex/api";
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

	const events = await fetchQuery(api.events.getCurrentSemester, { isExternal: isExternalEvents });
	const today = new Date();
	const semester = today.getMonth() < 7 ? "Vår" : "Høst";

	const monthOrder = [
		"januar",
		"februar",
		"mars",
		"april",
		"mai",
		"juni",
		"juli",
		"august",
		"september",
		"oktober",
		"november",
		"desember",
	];
	const months = Object.keys(events).sort(
		(a, b) => monthOrder.indexOf(a.toLowerCase()) - monthOrder.indexOf(b.toLowerCase()),
	);

	const currentMonth = today.toLocaleString("no", { month: "long" }).toLowerCase();
	const selectedMonth = searchParams?.get("month")?.toLowerCase();

	const activeMonth =
		selectedMonth && months.includes(selectedMonth)
			? selectedMonth
			: months.includes(currentMonth)
				? currentMonth
				: (months[0] ?? "januar");

	const activeMonthEvents = events[activeMonth] ?? [];

	return (
		<>
			<div className='grid gap-4'>
				<h1 className='scroll-m-20 text-balance text-center font-extrabold text-5xl text-primary tracking-tight'>
					Arrangementer
				</h1>
				<h3 className='scroll-m-20 text-center font-semibold text-2xl text-zinc-700 tracking-tight'>
					{semester} {today.getFullYear()}
				</h3>
			</div>

			<MonthSelector activeMonth={activeMonth} months={months} />
			<div className='h-full bg-[url(/Ns.svg)]'>
				<EventsList events={activeMonthEvents} isExternal={isExternalEvents} />
			</div>
		</>
	);
}
