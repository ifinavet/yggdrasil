import { Button } from "@workspace/ui/components/button";
import { Plus, Tags } from "lucide-react";
import Link from "next/link";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsGate } from "@/components/products/products-gate";
import { ProductsTable } from "@/components/products/products-table";
import { ProductStats } from "@/components/products/stats/product-stats";

export default function Products() {
	return (
		<ProductsGate>
			<ProductsBreadcrumb />
			<div className="mb-4 flex justify-end gap-2">
				<Button asChild variant="outline">
					<Link href="/products/tag">
						<Tags className="size-4" /> Merk arrangementer
					</Link>
				</Button>
				<Button asChild>
					<Link href="/products/new">
						<Plus className="size-4" /> Legg til et nytt produkt
					</Link>
				</Button>
			</div>
			<ProductsTable />
			<div className="mt-10">
				<ProductStats />
			</div>
		</ProductsGate>
	);
}
