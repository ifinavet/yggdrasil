import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import ParagraphSkeleton from "@/components/loaders/paragraph-skeleton";
import TitleSkeleton from "@/components/loaders/title-skeleton";

export default function LoadingInfoPage() {
	return (
		<ResponsiveCenterContainer>
			<Title>
				<TitleSkeleton className='h-12 w-96' />
			</Title>

			<div className='mx-auto rounded-xl bg-zinc-100 px-10 py-8 md:px-12 dark:bg-zinc-800'>
				<div className='prose max-w-[80ch] space-y-6'>
					<ParagraphSkeleton lines={3} />
					<ParagraphSkeleton lines={3} />
					<ParagraphSkeleton lines={4} />
					<ParagraphSkeleton lines={2} />
				</div>
			</div>
		</ResponsiveCenterContainer>
	);
}
