import type { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import type { CalloutTone } from "@workspace/ui/components/products/callout";
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

export const NEXT_STEPS: Record<InvoiceSummary["status"], { label: string; tone: CalloutTone }> = {
	scheduled: { label: "Ingen handling. Utkastet lages i Fiken automatisk.", tone: "neutral" },
	queued: { label: "Ingen handling. Utkastet lages i Fiken nå.", tone: "neutral" },
	draft_created: { label: "Kontroller utkastet og send fakturaen fra Fiken.", tone: "warning" },
	failed: { label: "Rett feilen og prøv igjen, eller avbryt fakturaen.", tone: "danger" },
	cancelled: { label: "Ingen handling. Fakturaen sendes ikke.", tone: "neutral" },
};

export const INVOICE_GROUPS = {
	failed: { label: "Feilet", statuses: ["failed"] },
	upcoming: { label: "Kommende", statuses: ["scheduled", "queued"] },
	previous: { label: "Tidligere", statuses: ["draft_created", "cancelled"] },
} as const satisfies Record<string, { label: string; statuses: InvoiceSummary["status"][] }>;

export type InvoiceGroup = keyof typeof INVOICE_GROUPS;

export function groupInvoices(invoices: InvoiceSummary[]): Record<InvoiceGroup, InvoiceSummary[]> {
	const inGroup = (group: InvoiceGroup) =>
		invoices.filter((invoice) =>
			(INVOICE_GROUPS[group].statuses as readonly InvoiceSummary["status"][]).includes(
				invoice.status,
			),
		);
	return {
		failed: inGroup("failed"),
		upcoming: [...inGroup("upcoming")].sort((a, b) => a.dueAt - b.dueAt),
		previous: inGroup("previous"),
	};
}

export function formatInvoiceDate(timestamp: number) {
	return formatOsloDate(timestamp, DATE_PATTERNS.numericDate);
}
