"use client";

import type { Id } from "@workspace/backend/convex/dataModel";
import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { use } from "react";
import { InvoiceDetail } from "@/components/invoicing/invoice-detail";

export default function InvoicePage({
	params,
}: Readonly<{ params: Promise<{ id: Id<"invoices"> }> }>) {
	const { id } = use(params);

	return (
		<FeatureGate feature="products">
			<InvoiceDetail id={id} />
		</FeatureGate>
	);
}
