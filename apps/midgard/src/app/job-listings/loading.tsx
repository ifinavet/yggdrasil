import { Skeleton } from "@workspace/ui/components/skeleton";
import { Title } from "@/components/common/title";
import JobListingBanner from "@/components/job-listings/job-listing-banner";
import JobListingCardSkeleton from "@/components/loaders/job-listing-card-skeleton";
import TitleSkeleton from "@/components/loaders/title-skeleton";

export default function JobListingsLoading() {
	return (
		<div className="box-border space-y-6">
			<Title className="mx-auto max-w-6xl">
				<TitleSkeleton />
			</Title>

			<div className="flex w-full max-w-[1300px] flex-col gap-4 sm:mx-auto md:flex-row">
				{/* Filter skeleton - desktop */}
				<div className="hidden h-fit w-fit space-y-6 rounded-lg border px-4 py-6 shadow-xs md:inline-block">
					{/* Sort select */}
					<div>
						<Skeleton className="h-10 w-[220px]" />
					</div>

					{/* Listing type group */}
					<div className="space-y-3">
						<Skeleton className="h-4 w-32" />
						<div className="space-y-2">
							{Array.from({ length: 4 }).map((_, i) => (
								<div className="flex items-center gap-2" key={`lt-${i + 1}`}>
									<Skeleton className="h-4 w-4 rounded-full" />
									<Skeleton className="h-4 w-24" />
								</div>
							))}
						</div>
					</div>

					{/* Company group */}
					<div className="space-y-3">
						<Skeleton className="h-4 w-40" />
						<div className="space-y-2">
							{Array.from({ length: 5 }).map((_, i) => (
								<div className="flex items-center gap-2" key={`comp-${i * 2}`}>
									<Skeleton className="h-4 w-4 rounded-full" />
									<Skeleton className="h-4 w-32" />
								</div>
							))}
						</div>
					</div>

					{/* Reset button */}
					<div>
						<Skeleton className="h-9 w-full rounded-md" />
					</div>
				</div>

				{/* Filter skeleton - mobile trigger */}
				<div className="mx-6 inline-block w-fit md:hidden">
					<Skeleton className="h-12 w-40 rounded-md" />
				</div>

				{/* Cards grid */}
				<div className="grid w-full min-w-0 grid-cols-1 items-center gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<JobListingCardSkeleton key={`job-card-${i * 3}`} />
					))}
				</div>
			</div>

			<JobListingBanner className="mt-12" />
		</div>
	);
}
