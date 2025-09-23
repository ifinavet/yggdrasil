import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";
import ButtonSkeleton from "../button-skeleton";
import EventCardSkeleton from "../event-card-skeleton";

export default function EventsCarouselSkeleton() {
	return (
		<div className="col-start-7 col-end-12 mx-6 md:justify-self-start xl:col-start-8">
			<Carousel className="mx-6 w-full max-w-64 sm:max-w-80 md:max-w-96">
				<CarouselContent>
					<CarouselItem key="event-skeleton-1">
						<div className="p-1">
							<EventCardSkeleton />
						</div>
					</CarouselItem>
					<CarouselItem key="event-skeleton-2">
						<div className="p-1">
							<EventCardSkeleton />
						</div>
					</CarouselItem>
					<CarouselItem key="event-skeleton-3">
						<div className="p-1">
							<EventCardSkeleton />
						</div>
					</CarouselItem>
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext />
			</Carousel>
			<ButtonSkeleton size="lg" className="mx-8" />
		</div>
	);
}
