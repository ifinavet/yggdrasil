import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@workspace/ui/components/carousel";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import EventCard from "@/components/events/event-card";
import { getNLatesEvents } from "@/lib/query/events";

export default async function MainPage() {
  const latestEvents = await getNLatesEvents(3);

  return (
    <ResponsiveCenterContainer>
      <div className="grid justify-center">
        <Carousel className='w-full max-w-64 md:max-w-96'>
          <CarouselContent>
            {latestEvents.map((event) => (
              <CarouselItem key={event.event_id}>
                <div className='p-1'>
                  <EventCard event={event} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </ResponsiveCenterContainer>
  );
}
