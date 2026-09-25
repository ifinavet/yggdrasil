import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsGate } from "@/components/products/products-gate";
import { EventTagging } from "@/components/products/tagging/event-tagging";

export default function TagEventProducts() {
	return (
		<ProductsGate>
			<ProductsBreadcrumb current="Merk arrangementer" />
			<EventTagging />
		</ProductsGate>
	);
}
