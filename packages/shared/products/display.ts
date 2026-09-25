import { formatNok, ORE_PER_KRONE, type VolumeTier } from "./money";

const offerCostFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const wholeNumberFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export const NO_FIXED_PRICE_LABEL = "Ingen fast pris";

export function formatPercent(value: number): string {
	return `${wholeNumberFormat.format(Math.round(value))} %`;
}

export function formatCount(value: number): string {
	return wholeNumberFormat.format(value);
}

export type PricedProduct = {
	unitPriceOre?: number;
	volumeTiers?: readonly VolumeTier[];
};

export function formatOfferCost(ore: number): string {
	return offerCostFormat.format(ore / ORE_PER_KRONE);
}

export function formatVolumeTier(tier: VolumeTier): string {
	return `${formatNok(tier.totalPriceOre)} for ${tier.quantity}`;
}

export function productPriceLabel(product: PricedProduct): string {
	if (product.unitPriceOre !== undefined) return formatNok(product.unitPriceOre);
	const firstTier = product.volumeTiers?.[0];
	if (firstTier) return formatVolumeTier(firstTier);
	return NO_FIXED_PRICE_LABEL;
}

export function productParagraphs(longDescription: string): string[] {
	return longDescription
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph !== "");
}
