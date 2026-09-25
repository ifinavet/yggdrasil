import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

export function Panel({
	title,
	aside,
	className,
	children,
}: Readonly<{ title?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }>) {
	return (
		<section className={cn("min-w-0 rounded-lg border bg-card", className)}>
			{title && (
				<header className="flex items-center justify-between gap-3 border-b px-4 py-3.5 font-semibold">
					{title}
					{aside}
				</header>
			)}
			{children}
		</section>
	);
}

export function PanelBody({
	className,
	children,
}: Readonly<{ className?: string; children: ReactNode }>) {
	return <div className={cn("p-4", className)}>{children}</div>;
}

export function PanelNote({ children }: Readonly<{ children: ReactNode }>) {
	return <span className="font-normal text-[13px] text-muted-foreground">{children}</span>;
}
