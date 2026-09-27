import type { Id } from "@workspace/backend/convex/dataModel";
import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { InvoiceDetail } from "@/components/invoicing/invoice-detail";

export default async function InvoicePage({
	params,
}: Readonly<{ params: Promise<{ id: Id<"invoices"> }> }>) {
	const { id } = await params;

	return (
		<FeatureGate feature="products">
			<InvoiceDetail id={id} />
		</FeatureGate>
	);
}
