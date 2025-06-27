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
import { getLatestEvents } from "@/lib/queries/events";

export default async function UpcomingEventsOverview() {
  try {
    const events = await getLatestEvents();
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
      const eventDate = new Date(event.event_start);
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    });

    const restOfEvents = events.filter((event) => {
      const eventDate = new Date(event.event_start);
      return eventDate > endOfWeek;
    });

    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Denne ukens arrangementer</h3>
          {thisWeeksEvents.map((event) => (
            <Card key={event.event_id} className='mb-4'>
              <CardHeader>
                <CardTitle>{event.title}</CardTitle>
                <CardDescription>
                  Hovedansvarlig:{" "}
                  {event.organizers.find((organizer) => organizer.role === "main")?.name ||
                    "Mangler..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>{event.teaser}</p>
              </CardContent>
              <CardFooter>Størrelse: {event.participants_limit} plasser</CardFooter>
            </Card>
          ))}
        </div>
        <Separator />
        <div className="space-y-2">
          <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Kommende arrangementer</h3>
          <ScrollArea>
            {restOfEvents.map((event) => (
              <Card key={event.event_id} className='mb-4'>
                <CardHeader>
                  <CardTitle>{event.title}</CardTitle>
                  <CardDescription>
                    Hovedansvarlig:{" "}
                    {event.organizers.find((organizer) => organizer.role === "main")?.name ||
                      "Mangler..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>{event.teaser}</p>
                </CardContent>
                <CardFooter>Størrelse: {event.participants_limit} plasser</CardFooter>
              </Card>
            ))}
          </ScrollArea>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error fetching events:", error);
    return (
      <>
        <p>Det oppstod en feil ved henting av hendelser.</p>
      </>
    );
  }
}
