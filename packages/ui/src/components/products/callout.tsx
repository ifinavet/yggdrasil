import { cn } from "@workspace/ui/lib/utils";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
	info: { className: "bg-primary-light text-primary", Icon: Info },
	warning: { className: "bg-warning-surface text-warning-surface-foreground", Icon: TriangleAlert },
	danger: { className: "bg-destructive/10 text-destructive", Icon: CircleAlert },
	neutral: { className: "bg-muted text-muted-foreground", Icon: CircleCheck },
} as const;

export type CalloutTone = keyof typeof TONES;

/** `icon` replaces the tone's own icon; the action wraps under the text when it runs out of room. */
export function Callout({
	tone = "info",
	icon,
	action,
	className,
	children,
}: Readonly<{
	tone?: CalloutTone;
	icon?: ReactNode;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}>) {
	const { className: toneClassName, Icon } = TONES[tone];
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px]",
				toneClassName,
				className,
			)}
		>
			{icon ?? <Icon className="size-4 shrink-0" />}
			<div className="min-w-0 flex-1 basis-48">{children}</div>
			{action && <div className="ml-auto flex shrink-0 flex-wrap gap-2">{action}</div>}
		</div>
	);
}
