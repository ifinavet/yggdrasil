import { Skeleton } from "@workspace/ui/components/skeleton";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import TwoColumns from "@/components/common/two-columns";
import ButtonSkeleton from "@/components/loaders/button-skeleton";
import EventsCarouselSkeleton from "@/components/loaders/home/events-carousel-skeleton";
import MainSponsorCardSkeleton from "@/components/loaders/home/main-sponsor-skeleton";
import JobListingCardSkeleton from "@/components/loaders/job-listing-card-skeleton";
import ParagraphSkeleton from "@/components/loaders/paragraph-skeleton";

export default function LoadingHomePage() {
	return (
		<div className='grid gap-8'>
			{/* Welcome banner skeleton */}
			{/*<div className='-mt-8 bg-primary-light py-4 text-center'>
				<Skeleton className='mx-auto h-6 w-96' />
			</div>*/}

			<ResponsiveCenterContainer>
				<div className='grid justify-center gap-8 md:grid-cols-2'>
					{/* Main sponsor skeleton */}
					<MainSponsorCardSkeleton />

					{/* Events carousel skeleton */}
					<EventsCarouselSkeleton />
				</div>
			</ResponsiveCenterContainer>

			{/* Job listings skeleton */}
			<JobListingCardSkeleton />

			{/* About section skeleton */}
			<ResponsiveCenterContainer>
				<TwoColumns
					className='!gap-2'
					main={
						<div className='space-y-6'>
							<Skeleton className='h-10 w-48' />
							<ParagraphSkeleton lines={3} />
							<ParagraphSkeleton lines={3} />
							<Skeleton className='h-6 w-40' />
							<div className='flex gap-4'>
								<Skeleton className='h-6 w-24' />
								<Skeleton className='h-6 w-24' />
								<Skeleton className='h-6 w-24' />
							</div>
						</div>
					}
					aside={
						<div className='relative mx-auto h-[280px] w-[280px] max-w-full sm:h-[350px] sm:w-[350px] md:h-[420px] md:w-[420px]'>
							<Skeleton className='absolute top-0 left-0 z-10 size-40 translate-x-4 translate-y-8 transform rounded-full sm:size-48 md:size-56' />
							<Skeleton className='-translate-x-4 -translate-y-8 absolute right-0 bottom-0 z-0 size-40 transform rounded-full sm:size-48 md:size-56' />
						</div>
					}
				/>
				<ButtonSkeleton className='mt-4' />
			</ResponsiveCenterContainer>
		</div>
	);
}
