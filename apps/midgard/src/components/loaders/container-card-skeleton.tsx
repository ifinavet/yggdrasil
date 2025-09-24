import { Skeleton } from "@workspace/ui/components/skeleton";
import ParagraphSkeleton from "./paragraph-skeleton";

export default function ContainerCardSkeleton() {
	return (
		<div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
			<div className="space-y-6">
				{/* Header section */}
				<div className="space-y-3">
					<Skeleton className="h-8 w-3/4 rounded-md" />
					<ParagraphSkeleton lines={3} />
				</div>

				{/* Paragraph sections with varied lengths */}
				<ParagraphSkeleton lines={3} />
				<ParagraphSkeleton lines={4} />

				{/* Link or button-like element */}
				<div className="flex items-center space-x-2">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-48 rounded-sm" />
				</div>
			</div>
		</div>
	);
}
