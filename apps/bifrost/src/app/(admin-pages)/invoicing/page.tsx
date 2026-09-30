import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { InvoicesTable } from "@/components/invoicing/invoices-table";

export default function Invoicing() {
	return (
		<FeatureGate feature="products">
			<InvoicesTable />
		</FeatureGate>
	);
}
