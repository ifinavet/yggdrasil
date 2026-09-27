import type { CalloutTone } from "@workspace/ui/components/products/callout";
import { cn } from "@workspace/ui/lib/utils";
import { type InvoiceSummary, NEXT_STEPS } from "./invoice-labels";

const TONE_TEXT: Record<CalloutTone, string> = {
	danger: "font-medium text-destructive",
	warning: "font-medium text-attention",
	info: "text-primary",
	neutral: "text-muted-foreground",
};

export function InvoiceNextStep({
	status,
	className,
}: Readonly<{ status: InvoiceSummary["status"]; className?: string }>) {
	const step = NEXT_STEPS[status];
	return <p className={cn(TONE_TEXT[step.tone], className)}>{step.label}</p>;
}
