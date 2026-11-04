import { api } from "@workspace/backend/convex/api";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import EventCard from "../events/events-card";
import NoMoreEventsEventCard from "../events/no-more-events-event-card";
import SeeAllEventsButton from "./see-all-events-button";

export default async function EventsCarousel({ className }: Readonly<{ className?: string }>) {
	"use cache";
	cacheLife({
		stale: 300, // 5 Minutes
		revalidate: 60 * 60 * 12, // 12 Hours
		expire: 60 * 60 * 48, // 2 days
	});

	const latestEvents = await fetchQuery(api.events.queries.getUpcoming, { n: 3 });

	return (
		<div className={cn(className, "grid justify-center gap-4")}>
			<Carousel className="mx-6 w-full max-w-64 sm:max-w-80 md:max-w-96">
				<CarouselContent>
					{latestEvents.length > 0 ? (
						latestEvents.map((event) => (
							<CarouselItem key={event._id}>
								<div className="p-1">
									<EventCard event={event} />
								</div>
							</CarouselItem>
						))
					) : (
						<CarouselItem>
							<div className="p-1">
								<NoMoreEventsEventCard />
							</div>
						</CarouselItem>
					)}
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext />
			</Carousel>
			<SeeAllEventsButton />
		</div>
	);
}
