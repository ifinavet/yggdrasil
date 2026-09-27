import { cn } from "@workspace/ui/lib/utils";
import { CircleAlert, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Colours come from the theme tokens, so the tones hold in dark mode too. The error tone is mixed
// towards the foreground, so it stays readable on both backgrounds.
const NOTE_TONES = {
	info: "bg-primary-light text-primary dark:bg-accent dark:text-accent-foreground",
	warn: "border border-[color-mix(in_oklab,var(--warning)_45%,var(--border))] bg-[color-mix(in_oklab,var(--warning)_10%,var(--card))] text-[color-mix(in_oklab,var(--warning)_60%,var(--foreground))]",
	bad: "border border-[color-mix(in_oklab,var(--destructive)_42%,var(--border))] bg-[color-mix(in_oklab,var(--destructive)_7%,var(--card))] font-medium text-[color-mix(in_oklab,var(--destructive)_82%,var(--foreground))]",
} as const;

export type NoteTone = keyof typeof NOTE_TONES;

/** A tinted message box with an icon: info, warn or bad (a high-contrast error). */
export function Note({
	tone = "info",
	icon,
	role,
	id,
	className,
	children,
}: Readonly<{
	tone?: NoteTone;
	icon?: LucideIcon;
	role?: "alert" | "status";
	id?: string;
	className?: string;
	children: ReactNode;
}>) {
	const Icon = icon ?? (tone === "info" ? Info : CircleAlert);
	return (
		<div
			id={id}
			role={role}
			className={cn(
				"flex gap-2.5 rounded-xl px-[14px] py-3 text-[13.5px] leading-[1.45]",
				NOTE_TONES[tone],
				className,
			)}
		>
			<Icon aria-hidden className="mt-0.5 size-4 flex-none" />
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
