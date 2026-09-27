import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { InvoicesTable } from "@/components/invoicing/invoices-table";
import { InvoicingBreadcrumb } from "@/components/invoicing/invoicing-breadcrumb";

export default function Invoicing() {
	return (
		<FeatureGate feature="products">
			<InvoicingBreadcrumb />
			<InvoicesTable />
		</FeatureGate>
	);
}
