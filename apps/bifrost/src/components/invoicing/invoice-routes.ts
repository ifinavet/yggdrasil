import type { Id } from "@workspace/backend/convex/dataModel";

export const INVOICE_ROUTES = {
	list: "/invoicing",
	detail: (invoiceId: Id<"invoices">) => `/invoicing/${invoiceId}`,
} as const;
