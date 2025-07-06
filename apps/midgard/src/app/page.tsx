import { Button } from "@workspace/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@workspace/ui/components/carousel";
import Link from "next/link";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import EventCard from "@/components/events/event-card";
import { getNLatesEvents } from "@/lib/query/events";

export default async function MainPage() {
  const latestEvents = await getNLatesEvents(3);

  return (
    <ResponsiveCenterContainer>
      <div className='grid gap-8 md:grid-cols-2'>
        <div className='order-2 md:order-1'></div>
        <div className="order-1 grid justify-center gap-2 md:order-2">
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
          <Button asChild className='mx-8 bg-emerald-600 py-6 font-semibold hover:bg-emerald-700'>
            <Link href={"/events"}>Se alle arrangementer</Link>
          </Button>
        </div>
      </div>
    </ResponsiveCenterContainer>
  );
}
