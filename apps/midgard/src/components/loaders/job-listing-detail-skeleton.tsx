import { Skeleton } from "@workspace/ui/components/skeleton";
import ParagraphSkeleton from "./paragraph-skeleton";

export default function JobListingDetailSkeleton() {
	return (
		<div className='grid grid-cols-1 gap-6 md:grid-cols-5'>
			<main className='gap-4 md:col-span-3'>
				<div>
					{/* Header section with deadline and type */}
					<div className='grid h-fit grid-cols-2 items-center justify-between gap-4 rounded-xl bg-primary px-10 pt-6 pb-12 text-primary-foreground md:px-16 md:pt-8'>
						<Skeleton className='h-8 w-32 rounded-md bg-primary-foreground/20' />
						<Skeleton className='h-8 w-32 rounded-md bg-primary-foreground/20' />
					</div>

					{/* Apply button skeleton */}
					<div className='-mt-8 mb-8 flex justify-center'>
						<Skeleton className='h-16 w-3/4 rounded-xl' />
					</div>
				</div>

				{/* Main content skeleton */}
				<div className='flex flex-col gap-4 rounded-xl bg-zinc-100 px-10 py-8 md:px-12'>
					{/* Teaser skeleton */}
					<Skeleton className='h-9 w-3/4 rounded-md' />

					{/* Description content skeleton */}
					<div className='space-y-6'>
						<ParagraphSkeleton lines={3} />
						<div>
							<Skeleton className='mb-2 h-6 w-48 rounded-md' />
							<ParagraphSkeleton lines={2} />
						</div>
						<ParagraphSkeleton lines={3} />
						<div>
							<Skeleton className='mb-2 h-6 w-36 rounded-md' />
							<ParagraphSkeleton lines={3} />
						</div>
					</div>
				</div>
			</main>

			{/* Sidebar skeleton */}
			<aside className='flex flex-col gap-8 md:col-span-2'>
				{/* Company section skeleton */}
				<div>
					<div className='relative aspect-square w-full'>
						<div className='absolute top-0 left-0 h-1/2 w-full bg-transparent'></div>
						<div className='absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100'></div>
						<div className='absolute inset-12 grid place-content-center rounded-full border-2 border-neutral-300 bg-white'>
							<Skeleton className='h-32 w-32 rounded-full' />
						</div>
					</div>
					<div className='rounded-b-xl bg-zinc-100 px-8 pb-8'>
						<div className='pt-4'>
							<ParagraphSkeleton lines={3} />
						</div>
					</div>
				</div>

				{/* Contact sections skeleton */}
				<div className='grid grid-cols-1 gap-4'>
					<div className='flex flex-wrap gap-4 rounded-xl bg-zinc-100 px-6 py-4'>
						<div className='flex w-full flex-col justify-between'>
							<div className='space-y-2'>
								<Skeleton className='h-6 w-32 rounded-md' />
								<Skeleton className='h-4 w-40 rounded-md' />
							</div>
							<div className='mt-4 space-y-2'>
								<Skeleton className='h-8 w-48 rounded-md' />
								<Skeleton className='h-8 w-32 rounded-md' />
							</div>
						</div>
					</div>
					<div className='flex flex-wrap gap-4 rounded-xl bg-zinc-100 px-6 py-4'>
						<div className='flex w-full flex-col justify-between'>
							<div className='space-y-2'>
								<Skeleton className='h-6 w-32 rounded-md' />
								<Skeleton className='h-4 w-40 rounded-md' />
							</div>
							<div className='mt-4 space-y-2'>
								<Skeleton className='h-8 w-48 rounded-md' />
								<Skeleton className='h-8 w-32 rounded-md' />
							</div>
						</div>
					</div>
				</div>
			</aside>
		</div>
	);
}
