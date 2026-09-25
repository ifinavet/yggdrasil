import { cn } from "@workspace/ui/lib/utils";
import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
	info: { className: "bg-primary-light text-primary", Icon: Info },
	warning: { className: "bg-warning-surface text-warning-surface-foreground", Icon: TriangleAlert },
} as const;

export function Callout({
	tone = "info",
	action,
	className,
	children,
}: Readonly<{
	tone?: keyof typeof TONES;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}>) {
	const { className: toneClassName, Icon } = TONES[tone];
	return (
		<div
			className={cn(
				"flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px]",
				toneClassName,
				className,
			)}
		>
			<Icon className="size-4 shrink-0" />
			<span>{children}</span>
			{action && <div className="ml-auto shrink-0">{action}</div>}
		</div>
	);
}
