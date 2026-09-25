import { Button } from "@workspace/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ProductsBreadcrumb } from "@/components/products/products-breadcrumb";
import { ProductsGate } from "@/components/products/products-gate";
import { ProductsTable } from "@/components/products/products-table";

export default function Products() {
	return (
		<ProductsGate>
			<ProductsBreadcrumb />
			<div className="mb-4 flex justify-end">
				<Button asChild>
					<Link href="/products/new">
						<Plus className="size-4" /> Legg til et nytt produkt
					</Link>
				</Button>
			</div>
			<ProductsTable />
		</ProductsGate>
	);
}
