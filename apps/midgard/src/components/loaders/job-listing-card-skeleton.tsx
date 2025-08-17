import { Skeleton } from "@workspace/ui/components/skeleton";

export default function JobListingCardSkeleton() {
	return (
		<div className='flex h-[450px] w-80 flex-col overflow-clip rounded-lg bg-white shadow-md'>
			{/* Type badge skeleton */}
			<Skeleton className='mb-6 h-12 w-full rounded-none' />

			{/* Company logo skeleton */}
			<div className='relative h-32 min-h-32 px-10'>
				<Skeleton className='h-full w-full rounded-md' />
			</div>

			{/* Content skeleton */}
			<div className='flex flex-1 flex-col justify-between gap-6 px-8 pb-6'>
				<div className='pt-4'>
					{/* Title skeleton */}
					<Skeleton className='mx-auto h-7 w-3/4 rounded-md' />
					{/* Teaser skeleton */}
					<div className='mt-2 space-y-2'>
						<Skeleton className='h-4 w-full rounded-md' />
						<Skeleton className='h-4 w-full rounded-md' />
						<Skeleton className='h-4 w-2/3 rounded-md' />
					</div>
				</div>
				{/* Button skeleton */}
				<Skeleton className='mt-4 h-10 w-full rounded-md' />
			</div>
		</div>
	);
}
