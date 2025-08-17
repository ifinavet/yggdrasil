import { Skeleton } from "@workspace/ui/components/skeleton";

export default function LargeUserCardSkeleton() {
	return (
		<div className='space-y-4'>
			{/* Large user card skeleton */}
			<div className='relative aspect-square max-h-36 w-full'>
				{/* Background sections */}
				<div className='absolute top-0 left-0 h-1/2 w-full bg-transparent'></div>
				<div className='absolute bottom-0 left-0 h-1/2 w-full rounded-t-xl bg-zinc-100'></div>
				{/* Circular avatar skeleton */}
				<div className='absolute inset-0 grid place-content-center'>
					<Skeleton className='h-36 w-36 rounded-full' />
				</div>
			</div>

			{/* User card content */}
			<div className='rounded-b-xl bg-zinc-100 px-8 pt-2 pb-8'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-full space-y-2 text-center'>
						<Skeleton className='mx-auto h-5 w-2/3' />
						<Skeleton className='mx-auto h-4 w-3/4' />
					</div>
					<Skeleton className='h-10 w-1/2 rounded-md' />
				</div>
			</div>
		</div>
	);
}
