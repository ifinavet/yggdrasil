import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@workspace/shared/products";
import { Badge } from "@workspace/ui/components/badge";

export function ProductStatusBadge({ active }: Readonly<{ active: boolean }>) {
	return (
		<Badge variant={active ? "default" : "secondary"}>{active ? "Aktiv" : "Arkivert"}</Badge>
	);
}

export function ProductCategoryBadge({ category }: Readonly<{ category: ProductCategory }>) {
	return <Badge variant="outline">{PRODUCT_CATEGORY_LABELS[category]}</Badge>;
}
