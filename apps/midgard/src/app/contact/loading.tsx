import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import TitleSkeleton from "@/components/loaders/title-skeleton";
import TwoColumnsLoading from "@/components/loaders/two-columns-loading";

export default function LoadingContactPage() {
	return (
		<ResponsiveCenterContainer>
			<Title>
				<TitleSkeleton />
			</Title>
			<TwoColumnsLoading />
		</ResponsiveCenterContainer>
	);
}
