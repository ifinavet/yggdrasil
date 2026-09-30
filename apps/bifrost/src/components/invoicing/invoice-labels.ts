import type { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import type { FunctionReturnType } from "convex/server";

export type InvoiceSummary = FunctionReturnType<typeof api.invoicing.admin.list>["page"][number];

export const KIND_LABELS: Record<InvoiceSummary["kind"], string> = {
	jobListingOrder: "Stillingsannonser",
	companyApplication: "Arrangement",
};

export const STATUS_BADGES: Record<
	InvoiceSummary["status"],
	{ label: string; variant: BadgeVariant }
> = {
	pending: { label: "Ikke sendt", variant: "muted" },
	sent: { label: "Sendt", variant: "secondary" },
	cancelled: { label: "Avbrutt", variant: "outline" },
};

export function groupPending(invoices: InvoiceSummary[], now = Date.now()) {
	return {
		ready: invoices.filter((invoice) => invoice.serviceAt <= now && !invoice.issue),
		blocked: invoices.filter((invoice) => Boolean(invoice.issue)),
		upcoming: invoices.filter((invoice) => invoice.serviceAt > now && !invoice.issue),
	};
}

export function formatInvoiceDate(timestamp: number) {
	return formatOsloDate(timestamp, DATE_PATTERNS.numericDate);
}
