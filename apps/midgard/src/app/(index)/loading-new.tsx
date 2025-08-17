import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@workspace/ui/components/carousel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import TwoColumns from "@/components/common/two-columns";
import ButtonSkeleton from "@/components/loaders/button-skeleton";
import EventCardSkeleton from "@/components/loaders/event-card-skeleton";
import JobListingCardSkeleton from "@/components/loaders/job-listing-card-skeleton";
import ParagraphSkeleton from "@/components/loaders/paragraph-skeleton";

export default function LoadingIndexPage() {
	return (
		<div className='grid gap-8'>
			{/* Welcome banner skeleton */}
			<div className='-mt-8 bg-primary-light py-4 text-center'>
				<Skeleton className='mx-auto h-6 w-96' />
			</div>

			<ResponsiveCenterContainer>
				<div className='grid justify-center gap-8 md:grid-cols-2'>
					{/* Main sponsor skeleton */}
					<div className='xl:-ml-24 order-2 max-w-xl space-y-6 md:order-1'>
						<Skeleton className='h-12 w-80' />
						<div className='flex flex-col items-center gap-6 rounded-xl bg-primary-light px-4 py-16 md:px-8 lg:flex-row'>
							<Skeleton className='size-32 rounded-full' />
							<div className='flex h-full flex-col justify-start gap-2'>
								<Skeleton className='h-10 w-48' />
								<ParagraphSkeleton lines={3} />
							</div>
						</div>
					</div>

					{/* Events carousel skeleton */}
					<div className='items-end-safe order-1 grid justify-center gap-2 md:order-2'>
						<Carousel className='mx-6 w-full max-w-64 sm:max-w-80 md:max-w-96'>
							<CarouselContent>
								<CarouselItem key='event-skeleton-1'>
									<div className='p-1'>
										<EventCardSkeleton />
									</div>
								</CarouselItem>
								<CarouselItem key='event-skeleton-2'>
									<div className='p-1'>
										<EventCardSkeleton />
									</div>
								</CarouselItem>
								<CarouselItem key='event-skeleton-3'>
									<div className='p-1'>
										<EventCardSkeleton />
									</div>
								</CarouselItem>
							</CarouselContent>
							<CarouselPrevious />
							<CarouselNext />
						</Carousel>
						<ButtonSkeleton size='lg' className='mx-8' />
					</div>
				</div>
			</ResponsiveCenterContainer>

			{/* Job listings skeleton */}
			<div className='h-full bg-[url(/Ns.svg)] py-16'>
				<ResponsiveCenterContainer className='space-y-6'>
					<Skeleton className='h-12 w-64' />
					<div className='flex flex-col items-center justify-evenly gap-6 md:flex-row'>
						<JobListingCardSkeleton key='job-skeleton-1' />
						<JobListingCardSkeleton key='job-skeleton-2' />
						<JobListingCardSkeleton key='job-skeleton-3' />
					</div>
					<div className='flex justify-center'>
						<ButtonSkeleton size='lg' className='mx-8 md:w-1/3' />
					</div>
				</ResponsiveCenterContainer>
			</div>

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
