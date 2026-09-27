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

export const NEXT_STEPS: Record<InvoiceSummary["status"], { label: string; needsAction: boolean }> =
	{
		scheduled: { label: "Ingen handling. Utkastet lages i Fiken automatisk.", needsAction: false },
		queued: { label: "Ingen handling. Utkastet lages i Fiken nå.", needsAction: false },
		draft_created: { label: "Kontroller utkastet og send fakturaen fra Fiken.", needsAction: true },
		failed: { label: "Rett feilen og prøv igjen, eller avbryt fakturaen.", needsAction: true },
		cancelled: { label: "Ingen handling. Fakturaen sendes ikke.", needsAction: false },
	};

export function formatInvoiceDate(timestamp: number) {
	return formatOsloDate(timestamp, DATE_PATTERNS.numericDate);
}
