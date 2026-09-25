import { Button } from "@workspace/ui/components/button";
import { FeatureGate } from "@workspace/ui/components/feature-gate";
import { Plus, Tags } from "lucide-react";
import Link from "next/link";
import { PRODUCT_ROUTES } from "@/components/products/product-routes";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsTable } from "@/components/products/products-table";
import { ProductStats } from "@/components/products/stats/product-stats";

export default function Products() {
	return (
		<FeatureGate feature="products">
			<ProductsBreadcrumb />
			<div className="mb-4 flex justify-end gap-2">
				<Button asChild variant="outline">
					<Link href={PRODUCT_ROUTES.tag}>
						<Tags className="size-4" /> Merk arrangementer
					</Link>
				</Button>
				<Button asChild>
					<Link href={PRODUCT_ROUTES.new}>
						<Plus className="size-4" /> Legg til et nytt produkt
					</Link>
				</Button>
			</div>
			<ProductsTable />
			<div className="mt-10">
				<ProductStats />
			</div>
		</FeatureGate>
	);
}
