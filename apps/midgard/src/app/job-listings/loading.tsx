import { Button } from "@workspace/ui/components/button";
import { Title } from "@/components/common/title";
import JobListingBanner from "@/components/job-listings/job-listing-banner";
import ButtonSkeleton from "@/components/loaders/button-skeleton";
import JobListingCardSkeleton from "@/components/loaders/job-listing-card-skeleton";

export default function JobListingsLoading() {
	return (
		<div className='grid h-full gap-6'>
			<div className='-mt-8 grid h-fit gap-4 bg-zinc-100 py-8'>
				<Title className='!border-b-0'>Stillingsannonser</Title>
				<div className='flex flex-wrap justify-center gap-4'>
					<Button asChild className='md:min-w-32'>
						<span>Alle</span>
					</Button>
					{/* Loading skeleton for filter buttons */}
					<ButtonSkeleton className='bg-primary/80 md:min-w-32' />
					<ButtonSkeleton size='sm' className='bg-primary/80' />
					<ButtonSkeleton className='bg-primary/80' />
				</div>
			</div>
			<div className='mx-auto grid w-full max-w-5xl grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3'>
				{/* Loading skeleton for job listing cards */}
				<JobListingCardSkeleton key='job-card-1' />
				<JobListingCardSkeleton key='job-card-2' />
				<JobListingCardSkeleton key='job-card-3' />
				<JobListingCardSkeleton key='job-card-4' />
				<JobListingCardSkeleton key='job-card-5' />
				<JobListingCardSkeleton key='job-card-6' />
			</div>
			<JobListingBanner className='mt-12' />
		</div>
	);
}
