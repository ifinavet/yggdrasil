import { tierTotalOre, type VolumeTier } from "../products/money";

export type ListingProduct = Readonly<{
	volumeTiers?: readonly VolumeTier[];
	startupPriceOre?: number;
}>;

export function orderPriceOre(product: ListingProduct, quantity: number, startup: boolean): number {
	if (startup && product.startupPriceOre !== undefined) return product.startupPriceOre * quantity;
	return tierTotalOre(product.volumeTiers ?? [], quantity);
}

export function packageSizes(product: ListingProduct): number[] {
	return (product.volumeTiers ?? []).map((tier) => tier.quantity).sort((a, b) => a - b);
}
