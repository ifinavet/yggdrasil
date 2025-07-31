import type { EventWithParticipationCount } from "@/constants/event-types";
import EventCard from "./event-list-card";

export default async function EventsList({
  events,
  isExternal,
}: {
  events: EventWithParticipationCount[];
  isExternal: boolean;
}) {
  return (
    <div className='mx-6 md:mx-auto md:w-3/5'>
      <div className='flex flex-col gap-6'>
        {events.map((event) => (
          <EventCard key={event._id} event={event} isExternal={isExternal} />
        ))}
      </div>
    </div>
  );
}
