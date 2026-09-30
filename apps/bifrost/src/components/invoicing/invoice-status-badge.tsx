import { Badge } from "@workspace/ui/components/badge";
import { type InvoiceSummary, STATUS_BADGES } from "./invoice-labels";

export function InvoiceStatusBadge({
	invoice,
}: Readonly<{ invoice: Pick<InvoiceSummary, "status"> }>) {
	const badge = STATUS_BADGES[invoice.status];
	return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
