import { type ApplicationStatus, STATUS_LABELS } from "@workspace/shared/semester/labels";
import { cn } from "@workspace/ui/lib/utils";
import { STATUS_DOT_CLASSES, STATUS_ICONS } from "./status";

/** One quiet dot and the Norwegian label for an application status. */
export function StatusBadge({
	status,
	className,
}: Readonly<{ status: ApplicationStatus; className?: string }>) {
	return (
		<span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm", className)}>
			<span
				aria-hidden
				className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASSES[status])}
			/>
			{STATUS_LABELS[status]}
		</span>
	);
}

/** The symbol for an application status, in its colour. */
export function StatusIcon({
	status,
	className,
}: Readonly<{ status: ApplicationStatus; className?: string }>) {
	const { icon: Icon, className: colour } = STATUS_ICONS[status];
	return (
		<Icon
			aria-hidden
			className={cn("size-[18px] shrink-0", colour, className)}
			strokeWidth={2.25}
		/>
	);
}
