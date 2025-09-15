import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

export function Title({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<h1
			className={cn(
				className,
				"mb-4 scroll-m-20 text-balance border-primary border-b-2 pb-2 text-center font-extrabold text-4xl text-primary tracking-tight md:text-5xl dark:border-primary-foreground dark:text-primary-foreground",
			)}
		>
			{children}
		</h1>
	);
}
