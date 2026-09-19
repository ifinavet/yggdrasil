import { placeholderKeys } from "@workspace/shared/utils";
import { Skeleton } from "@workspace/ui/components/skeleton";

interface ParagraphSkeletonProps {
	readonly lines?: number;
	readonly className?: string;
}

export default function ParagraphSkeleton({
	lines = 3,
	className,
}: Readonly<ParagraphSkeletonProps>) {
	const widthVariations = ["w-full", "w-full", "w-5/6", "w-4/5", "w-3/4", "w-2/3"];

	return (
		<div className={`space-y-2 ${className || ""}`}>
			{placeholderKeys("paragraph-line", lines).map((key, index) => (
				<Skeleton
					key={key}
					className={`h-4 ${widthVariations[index % widthVariations.length]} dark:bg-primary-foreground/80`}
				/>
			))}
		</div>
	);
}
