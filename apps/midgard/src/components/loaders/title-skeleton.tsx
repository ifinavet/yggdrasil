import { Skeleton } from "@workspace/ui/components/skeleton";

export default function TitleSkeleton({
	className,
}: Readonly<{ className?: string }>) {
	return (
		<Skeleton className={`mx-auto h-16 w-80 rounded-md ${className || ""}`} />
	);
}
