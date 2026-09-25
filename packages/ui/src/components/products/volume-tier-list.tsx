import { formatNokFromOre, formatVolumeTier, type VolumeTier } from "@workspace/shared/products";

export function VolumeTierList({
	tiers,
	startupPriceOre,
}: Readonly<{ tiers: readonly VolumeTier[]; startupPriceOre?: number }>) {
	return (
		<ul className="space-y-1 text-sm">
			{tiers.map((tier) => (
				<li key={tier.quantity}>{formatVolumeTier(tier)}</li>
			))}
			{startupPriceOre !== undefined && (
				<li className="text-muted-foreground">
					Oppstartsbedrifter: {formatNokFromOre(startupPriceOre)} per annonse
				</li>
			)}
		</ul>
	);
}
