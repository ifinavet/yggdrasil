import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import EventCard from "../events/event-card";

export default async function EventsCarousel({ className }: Readonly<{ className?: string }>) {
	const latestEvents = await fetchQuery(api.events.getLatest, { n: 3 });

	return (
		<div className={cn(className, "grid justify-center gap-4")}>
			<Carousel className="mx-6 w-full max-w-64 sm:max-w-80 md:max-w-96">
				<CarouselContent>
					{latestEvents.map((event) => (
						<CarouselItem key={event._id}>
							<div className="p-1">
								<EventCard event={event} />
							</div>
						</CarouselItem>
					))}
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext />
			</Carousel>
			<Button
				asChild
				className="mx-8 bg-emerald-600 py-6 font-semibold text-primary-foreground hover:bg-emerald-700 md:mx-16"
			>
				<Link href={"/events"}>Se alle arrangementer</Link>
			</Button>
		</div>
	);
}
