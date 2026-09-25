import { Button } from "@workspace/ui/components/button";
import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsTable } from "@/components/products/products-table";

export default function Products() {
	return (
		<FeatureGate feature="products">
			<ProductsBreadcrumb />
			<div className="mb-4 flex justify-end">
				<Button asChild>
					<Link href="/products/new">
						<Plus className="size-4" /> Legg til et nytt produkt
					</Link>
				</Button>
			</div>
			<ProductsTable />
		</FeatureGate>
	);
}
