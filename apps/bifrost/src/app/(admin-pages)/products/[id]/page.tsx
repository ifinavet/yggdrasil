import type { Id } from "@workspace/backend/convex/dataModel";
import { EditProduct } from "@/components/products/edit-product";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsGate } from "@/components/products/products-gate";

export default async function ProductPage({
	params,
}: Readonly<{ params: Promise<{ id: Id<"products"> }> }>) {
	const { id } = await params;

	return (
		<ProductsGate>
			<ProductsBreadcrumb current="Rediger produkt" />
			<EditProduct id={id} />
		</ProductsGate>
	);
}
