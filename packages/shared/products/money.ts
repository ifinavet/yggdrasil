export const ORE_PER_KRONE = 100;
export const DEFAULT_VAT_RATE = 25;

export type VolumeTier = { quantity: number; totalPriceOre: number };

const nokFormat = new Intl.NumberFormat("nb-NO", {
	style: "currency",
	currency: "NOK",
	maximumFractionDigits: 0,
});

export function formatNokFromOre(ore: number): string {
	return nokFormat.format(ore / ORE_PER_KRONE);
}

export function kronerToOre(kroner: number): number {
	return Math.round(kroner * ORE_PER_KRONE);
}

export function oreToKroner(ore: number): number {
	return ore / ORE_PER_KRONE;
}

export function tierTotalOre(tiers: readonly VolumeTier[], quantity: number): number {
	if (quantity <= 0 || tiers.length === 0) return 0;

	const ascending = [...tiers].sort((a, b) => a.quantity - b.quantity);
	const smallestFitting = ascending.find((tier) => tier.quantity >= quantity);
	if (smallestFitting) return smallestFitting.totalPriceOre;

	const largest = ascending.at(-1) as VolumeTier;
	return largest.totalPriceOre + tierTotalOre(ascending, quantity - largest.quantity);
}
