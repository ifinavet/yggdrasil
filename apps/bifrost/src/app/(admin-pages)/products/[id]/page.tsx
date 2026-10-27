import type { Id } from "@workspace/backend/convex/dataModel";
import { Suspense } from "react";
import { EditProduct } from "@/components/products/edit-product";

type Props = Readonly<{ params: Promise<{ id: Id<"products"> }> }>;

export default function ProductPage(props: Props) {
	return (
		<Suspense fallback={null}>
			<Product {...props} />
		</Suspense>
	);
}

async function Product({ params }: Props) {
	const { id } = await params;

	return <EditProduct id={id} />;
}
