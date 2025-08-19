import { api } from "@workspace/backend/convex/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";

type Event = {
  _id: string;
  title: string;
  organizers: { role: string; name: string }[];
  teaser: string;
  participationLimit: number;
};

function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event._id}`}>
      <Card className='mb-4'>
        <CardHeader>
          <CardTitle>{event.title}</CardTitle>
          <CardDescription>
            Hovedansvarlig:{" "}
            {event.organizers.find((organizer) => organizer.role === "hovedansvarlig")?.name ||
              "Mangler..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>{event.teaser}</p>
        </CardContent>
        <CardFooter>Størrelse: {event.participationLimit} plasser</CardFooter>
      </Card>
    </Link>
  );
}

export default async function UpcomingEventsOverview({ className }: { className?: string }) {
  try {
    const events = await fetchQuery(api.events.getLatest, { n: 7 });

    const now = new Date();

    // Start of week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);

    // End of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const thisWeeksEvents = events.filter((event) => {
      const eventDate = new Date(event.eventStart);
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    });

    const restOfEvents = events.filter((event) => {
      const eventDate = new Date(event.eventStart);
      return eventDate > endOfWeek;
    });

    return (
      <div className={cn(className, "flex flex-col gap-4")}>
        <div className='space-y-2'>
          <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>
            Denne ukens arrangementer
          </h3>
          {thisWeeksEvents.length > 0 ? (
            thisWeeksEvents.map((event) => <EventCard key={event._id} event={event} />)
          ) : (
            <p>Ingen flere arrangementer denne uken.</p>
          )}
        </div>
        <Separator />
        <div className='space-y-2'>
          <h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>
            Kommende arrangementer
          </h3>
          <ScrollArea>
            {restOfEvents.length > 0 ? (
              restOfEvents.map((event) => <EventCard key={event._id} event={event} />)
            ) : (
              <p>Ingen kommende arrangementer.</p>
            )}
          </ScrollArea>
        </div>
      </div>
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Ukjent feil";
    return (
      <>
        <p>Det oppstod en feil ved henting av hendelser.</p>
        <small>Feilmelding: {errorMessage}</small>
      </>
    );
  }
}
