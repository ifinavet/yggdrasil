import { cn } from "@workspace/ui/lib/utils";
import { type InvoiceSummary, NEXT_STEPS } from "./invoice-labels";

export function InvoiceNextStep({
	status,
	className,
}: Readonly<{ status: InvoiceSummary["status"]; className?: string }>) {
	const step = NEXT_STEPS[status];
	return (
		<p
			className={cn(
				step.needsAction ? "font-medium text-foreground" : "text-muted-foreground",
				className,
			)}
		>
			{step.label}
		</p>
	);
}
