import { api } from "@workspace/backend/convex/api";
import { isEventProduct, type ProductCategory } from "@workspace/shared/products";
import { ProductOfferCard } from "@workspace/ui/components/products/offer-card";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import type { ReactNode } from "react";

const EXTERNAL_EVENT_FORM_LINK = (
	<a
		href="https://forms.gle/WYjKsepiBVYddSTG7"
		target="_blank"
		rel="noopener noreferrer"
		className="underline"
	>
		Skjema for eksterne arrangementer
	</a>
);

const LAST_ITEM_SUFFIX: Partial<Record<ProductCategory, ReactNode>> = {
	external_event: EXTERNAL_EVENT_FORM_LINK,
};

export default async function OfferGrid({ className }: Readonly<{ className?: string }>) {
	const products = await fetchQuery(api.products.queries.listActive);
	const offers = products.filter(
		(product) => isEventProduct(product) && product.unitPriceOre !== undefined,
	);

	return (
		<div className={cn(className, "grid grid-cols-1 gap-6 md:grid-cols-2")}>
			{offers.map((product) => (
				<ProductOfferCard
					key={product._id}
					product={product}
					lastItemSuffix={LAST_ITEM_SUFFIX[product.category]}
				/>
			))}
		</div>
	);
}
