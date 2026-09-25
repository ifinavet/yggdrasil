import type { Id } from "@workspace/backend/convex/dataModel";
import { EditProduct } from "@/components/products/edit-product";
import { ProductsGate } from "@/components/products/products-gate";

export default async function ProductPage({
	params,
}: Readonly<{ params: Promise<{ id: Id<"products"> }> }>) {
	const { id } = await params;

	return (
		<ProductsGate>
			<EditProduct id={id} />
		</ProductsGate>
	);
}
