import { Skeleton } from "@workspace/ui/components/skeleton";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import ButtonSkeleton from "../button-skeleton";
import JobListingCardSkeleton from "../job-listing-card-skeleton";

export default function JobListingsSkeleton() {
	return (
		<div className="h-full bg-[url(/Ns.svg)] py-16">
			<ResponsiveCenterContainer className="space-y-6">
				<Skeleton className="h-12 w-64" />
				<div className="flex flex-col items-center justify-evenly gap-6 md:flex-row">
					<JobListingCardSkeleton key="job-skeleton-1" />
					<JobListingCardSkeleton key="job-skeleton-2" />
					<JobListingCardSkeleton key="job-skeleton-3" />
				</div>
				<div className="flex justify-center">
					<ButtonSkeleton size="lg" className="mx-8 md:w-1/3" />
				</div>
			</ResponsiveCenterContainer>
		</div>
	);
}
