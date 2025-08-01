import { URLSearchParams } from "node:url";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { fetchQuery } from "convex/nextjs";
import { Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import type { Event, Organizer } from "@/constants/types";
import { humanReadableDate } from "@/utils/utils";

function EventCard({
  title,
  eventId,
  companyName,
  date,
  isPublished,
  externalUrl,
  organizers,
}: {
  title: string;
  eventId: string;
  companyName: string;
  date: number;
  isPublished: boolean;
  externalUrl?: string;
  organizers: Organizer[];
}) {
  const isExternal = !(externalUrl === undefined || externalUrl === "");

  return (
    <Link href={`/events/${eventId}`} className='flex flex-col gap-6'>
      <Card className='h-full'>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{humanReadableDate(new Date(date))}</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-1 flex-col gap-4'>
          <div className='flex flex-row flex-wrap gap-2'>
            <h3>
              <span className='font-semibold'>Bedrift:</span> {companyName}
            </h3>
          </div>
          <div className='flex flex-wrap gap-2'>
            {isExternal && <Badge>Externt arrangement</Badge>}
            {!isPublished && <Badge variant='secondary'>Avpublisert</Badge>}
          </div>
        </CardContent>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>
            <Users className='size-4' /> Ansvarlige
          </div>
          <div className='text-muted-foreground'>
            {organizers.map((organizer) => (
              <h3 key={organizer._id}>
                <span className='font-semibold capitalize'>{organizer.role}: </span>
                {organizer.name}
              </h3>
            ))}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

function EventsGridContent({
  publishedEvents,
  unpublishedEvents,
}: {
  publishedEvents: Event[];
  unpublishedEvents: Event[];
}) {
  return (
    <div className='grid gap-6'>
      {publishedEvents.length > 0 || unpublishedEvents.length > 0 ? (
        <>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0'>
            Publiserte arrangementer
          </h2>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {publishedEvents.map((event) => (
              <EventCard
                key={event._id}
                eventId={event._id}
                title={event.title}
                companyName={event.hostingCompanyName}
                date={event.eventStart}
                isPublished={event.published}
                externalUrl={event.externalUrl}
                organizers={event.organizers}
              />
            ))}
          </div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0'>
            Skjulte/Påbegynte arrangementer
          </h2>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {unpublishedEvents.map((event) => (
              <EventCard
                key={event._id}
                eventId={event._id}
                title={event.title}
                companyName={event.hostingCompanyName}
                date={event.eventStart}
                isPublished={event.published}
                externalUrl={event.externalUrl}
                organizers={event.organizers}
              />
            ))}
          </div>
        </>
      ) : (
        <p>Vi fant ingen arrangementer</p>
      )}
    </div>
  );
}

export default async function EventsGrid() {
  const pathname = (await headers()).get("x-searchParams");
  let searchParams: URLSearchParams | undefined;
  if (pathname) searchParams = new URLSearchParams(pathname);

  const year = searchParams?.get("year") || new Date().getFullYear().toString();
  const semester = searchParams?.get("semester") || (new Date().getMonth() < 7 ? "vår" : "høst");

  const events = await fetchQuery(api.events.getAll, {
    year: Number.parseInt(year),
    semester,
  });

  const publishedEvents = await Promise.all(
    (events?.published || []).map(async (event) => {
      const organizers = await fetchQuery(api.events.getOrganizersByEventId, {
        id: event._id as Id<"events">,
      });
      return { ...event, organizers };
    }),
  );

  const unpublishedEvents = await Promise.all(
    (events?.unpublished || []).map(async (event) => {
      const organizers = await fetchQuery(api.events.getOrganizersByEventId, {
        id: event._id as Id<"events">,
      });
      return { ...event, organizers };
    }),
  );

  return (
    <EventsGridContent publishedEvents={publishedEvents} unpublishedEvents={unpublishedEvents} />
  );
}
