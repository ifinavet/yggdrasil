import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import EventCard from "../events/event-card";

export default async function EventsCarousel() {
	const latestEvents = await fetchQuery(api.events.getLatest, { n: 3 });

	return (
		<div className='items-end-safe order-1 grid justify-center gap-2 md:order-2'>
			<Carousel className='mx-6 w-full max-w-64 sm:max-w-80 md:max-w-96'>
				<CarouselContent>
					{latestEvents.map((event) => (
						<CarouselItem key={event._id}>
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
	);
}
