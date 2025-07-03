import { headers } from "next/headers";
import EventsList from "@/components/events/events-list";
import MonthSelector from "@/components/events/month-selector";
import { getAllEventsCurrentSemester } from "@/lib/query/events";
import type { Tables } from "@/lib/supabase/database.types";

export default async function EventsPage() {
  const pathname = (await headers()).get("x-searchParams");
  let searchParams: URLSearchParams | undefined;
  if (pathname) searchParams = new URLSearchParams(pathname);
  const isExternalEvents = searchParams?.get("external") === "true";

  const events = await getAllEventsCurrentSemester(isExternalEvents);
  const today = new Date();
  const semester = today.getMonth() < 7 ? "Vår" : "Høst";

  const months = Object.keys(events);

  const currentMonth = today.toLocaleString("no", { month: "long" });
  const selectedMonth = searchParams?.get("month");

  let activeMonthAndEvents = Object.entries(events).find(
    ([month]) => month === selectedMonth || month === currentMonth,
  );

  if (activeMonthAndEvents === undefined) {
    activeMonthAndEvents = Object.entries(events)[0];
  }

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

      <MonthSelector activeMonth={activeMonthAndEvents?.[0] || "ukjent"} months={months} />
      <div className='h-full bg-[url(/Ns.svg)]'>
        <EventsList
          events={
            activeMonthAndEvents?.[1] as Tables<"published_events_with_participation_count">[]
          }
          isExternal={isExternalEvents}
        />
      </div>
    </>
  );
}
