import { type ApplicationStatus, STATUS_LABELS } from "@workspace/shared/semester/labels";
import { cn } from "@workspace/ui/lib/utils";
import { STATUS_DOT_CLASSES } from "./status";

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
