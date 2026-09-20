import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { Title } from "@workspace/ui/components/title";
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
