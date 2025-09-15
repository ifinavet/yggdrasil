import { Skeleton } from "@workspace/ui/components/skeleton";

interface ParagraphSkeletonProps {
	lines?: number;
	className?: string;
}

export default function ParagraphSkeleton({ lines = 3, className }: ParagraphSkeletonProps) {
	const widthVariations = ["w-full", "w-full", "w-5/6", "w-4/5", "w-3/4", "w-2/3"];

	return (
		<div className={`space-y-2 ${className || ""}`}>
			{Array.from({ length: lines }).map((_, index) => {
				const widthClass = widthVariations[index % widthVariations.length];
				return <Skeleton key={`paragraph-line-${index + 1}`} className={`h-4 ${widthClass} dark:bg-primary-foreground/80`} />;
			})}
		</div>
	);
}
