import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { CreateProduct } from "@/components/products/create-product";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";

export default function NewProduct() {
	return (
		<FeatureGate feature="products">
			<ProductsBreadcrumb current="Nytt produkt" />
			<CreateProduct />
		</FeatureGate>
	);
}
