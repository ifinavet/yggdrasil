import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import JobListingDetailSkeleton from "@/components/loaders/job-listing-detail-skeleton";
import TitleSkeleton from "@/components/loaders/title-skeleton";

export default function JobListingLoading() {
	return (
		<ResponsiveCenterContainer>
			{/* Title skeleton */}
			<Title>
				<TitleSkeleton />
			</Title>

			<JobListingDetailSkeleton />
		</ResponsiveCenterContainer>
	);
}
