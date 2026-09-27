import { Badge } from "@workspace/ui/components/badge";
import { type InvoiceSummary, STATUS_BADGES } from "./invoice-labels";

export function InvoiceStatusBadge({
	invoice,
}: Readonly<{ invoice: Pick<InvoiceSummary, "status" | "fikenDraftId"> }>) {
	const badge = STATUS_BADGES[invoice.status];
	return (
		<Badge variant={badge.variant}>
			{invoice.fikenDraftId ? `${badge.label} #${invoice.fikenDraftId}` : badge.label}
		</Badge>
	);
}
