import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import type { ReactNode } from "react";

export function Panel({
	title,
	aside,
	description,
	className,
	children,
}: Readonly<{
	title?: ReactNode;
	aside?: ReactNode;
	description?: ReactNode;
	className?: string;
	children: ReactNode;
}>) {
	return (
		<Card className={cn("min-w-0 gap-0 rounded-lg py-0 shadow-none", className)}>
			{title && (
				<CardHeader className="block border-b px-4 py-3.5 [.border-b]:pb-3.5">
					<div className="flex items-center justify-between gap-3 font-semibold">
						{title}
						{aside}
					</div>
					{description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
				</CardHeader>
			)}
			{children}
		</Card>
	);
}

export function PanelBody({
	className,
	children,
}: Readonly<{ className?: string; children: ReactNode }>) {
	return <CardContent className={cn("p-4", className)}>{children}</CardContent>;
}

export function PanelNote({ children }: Readonly<{ children: ReactNode }>) {
	return <span className="font-normal text-[13px] text-muted-foreground">{children}</span>;
}
