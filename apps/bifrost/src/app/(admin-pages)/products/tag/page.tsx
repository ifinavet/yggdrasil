import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { EventTagging } from "@/components/products/tagging/event-tagging";

export default function TagEventProducts() {
	return (
		<FeatureGate feature="products">
			<ProductsBreadcrumb current="Merk arrangementer" />
			<EventTagging />
		</FeatureGate>
	);
}
