import { LISTING_COLORS } from "@workspace/shared/constants";
import { cn } from "@workspace/ui/lib/utils";

export function JobTypeLabel({ type }: Readonly<{ type: string }>) {
	return (
		<>
			<span
				aria-hidden="true"
				className={cn("size-4 shrink-0 rounded-full", LISTING_COLORS[type] ?? "bg-gray-400")}
			/>
			{type}
		</>
	);
}
