import { cn } from "@workspace/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function Fold({
	title,
	children,
	className,
	open,
}: Readonly<{ title: ReactNode; children: ReactNode; className?: string; open?: boolean }>) {
	return (
		<details open={open} className={cn("group rounded-lg border bg-card", className)}>
			<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
				<ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-90" />
				{title}
			</summary>
			<div className="border-t">{children}</div>
		</details>
	);
}
