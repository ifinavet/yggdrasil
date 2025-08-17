import { Skeleton } from "@workspace/ui/components/skeleton";

interface ButtonSkeletonProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

export default function ButtonSkeleton({ className, size = "md" }: ButtonSkeletonProps) {
	const sizeClasses = {
		sm: "h-8 w-20",
		md: "h-10 w-32",
		lg: "h-12 w-40",
	};

	return <Skeleton className={`${sizeClasses[size]} rounded-md ${className || ""}`} />;
}
