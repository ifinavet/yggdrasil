import { Skeleton } from "@workspace/ui/components/skeleton";
import ParagraphSkeleton from "../paragraph-skeleton";

export default function MainSponsorCardSkeleton() {
	return (
		<div className='xl:-ml-24 order-2 max-w-xl space-y-6 md:order-1'>
			<Skeleton className='h-12 w-80' />
			<div className='flex flex-col items-center gap-6 rounded-xl bg-primary-light px-4 py-16 md:px-8 lg:flex-row dark:bg-primary'>
				<Skeleton className='size-32 rounded-full' />
				<div className='flex h-full flex-col justify-start gap-2'>
					<Skeleton className='h-10 w-48 dark:bg-primary-foreground/80' />
					<ParagraphSkeleton lines={3} />
				</div>
			</div>
		</div>
	);
}
