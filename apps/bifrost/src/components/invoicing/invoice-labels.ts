import type { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import type { FunctionReturnType } from "convex/server";

export type InvoiceSummary = FunctionReturnType<typeof api.invoicing.admin.list>[number];

export const KIND_LABELS: Record<InvoiceSummary["kind"], string> = {
	jobListingOrder: "Stillingsannonser",
	companyApplication: "Bedriftspresentasjon",
};

export const STATUS_BADGES: Record<
	InvoiceSummary["status"],
	{ label: string; variant: BadgeVariant }
> = {
	scheduled: { label: "Planlagt", variant: "muted" },
	queued: { label: "Sendes", variant: "soft" },
	draft_created: { label: "Utkast i Fiken", variant: "secondary" },
	failed: { label: "Feilet", variant: "destructive" },
	cancelled: { label: "Avbrutt", variant: "outline" },
};

export function formatInvoiceDate(timestamp: number) {
	return formatOsloDate(timestamp, DATE_PATTERNS.numericDate);
}
