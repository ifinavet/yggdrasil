import { CreateProduct } from "@/components/products/create-product";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";

export default function NewProduct() {
	return (
		<>
			<ProductsBreadcrumb current="Nytt produkt" />
			<CreateProduct />
		</>
	);
}
