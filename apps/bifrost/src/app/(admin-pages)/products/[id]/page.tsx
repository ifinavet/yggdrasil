import type { Id } from "@workspace/backend/convex/dataModel";
import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { EditProduct } from "@/components/products/edit-product";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";

export default async function ProductPage({
	params,
}: Readonly<{ params: Promise<{ id: Id<"products"> }> }>) {
	const { id } = await params;

	return (
		<FeatureGate feature="products">
			<ProductsBreadcrumb current="Rediger produkt" />
			<EditProduct id={id} />
		</FeatureGate>
	);
}
