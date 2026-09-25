import { CreateProduct } from "@/components/products/create-product";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsGate } from "@/components/products/products-gate";

export default function NewProduct() {
	return (
		<ProductsGate>
			<ProductsBreadcrumb current="Nytt produkt" />
			<CreateProduct />
		</ProductsGate>
	);
}
