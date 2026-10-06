import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { EventTagging } from "@/components/products/tagging/event-tagging";

export default function TagEventProducts() {
	return (
		<>
			<ProductsBreadcrumb current="Merk arrangementer" />
			<EventTagging />
		</>
	);
}
