import { Skeleton } from "@workspace/ui/components/skeleton";

export default function EventCardSkeleton() {
	return (
		<div className='flex h-100 flex-col overflow-clip rounded-lg border border-primary/10 shadow-md'>
			<Skeleton className='h-32 w-full md:h-48 lg:h-52' />
			<div className='flex flex-1 flex-col justify-between bg-primary p-6'>
				<div className='flex flex-col gap-4'>
					<Skeleton className='h-6 w-3/4 bg-primary-foreground/20' />
					<Skeleton className='h-4 w-full bg-primary-foreground/20' />
					<Skeleton className='h-4 w-2/3 bg-primary-foreground/20' />
				</div>
				<div className='mt-4 flex flex-col justify-center gap-4 sm:flex-row'>
					<Skeleton className='h-4 w-24 bg-primary-foreground/20' />
					<Skeleton className='h-4 w-20 bg-primary-foreground/20' />
				</div>
			</div>
		</div>
	);
}
