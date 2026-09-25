import {
	formatCount,
	formatNok,
	NO_FIXED_PRICE_LABEL,
	type ProductMixRow,
} from "@workspace/shared/products";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import { SERIES_COLORS } from "./series-colors";

const ROW = "grid grid-cols-[minmax(0,1fr)_90px] gap-x-3 gap-y-1 border-b py-2 last:border-b-0";

export function ProductMix({
	rows,
	scopeLabel,
}: Readonly<{ rows: readonly ProductMixRow[]; scopeLabel: string }>) {
	const totalOre = rows.reduce((sum, row) => sum + row.revenueOre, 0);

	return (
		<Panel title="Produktmiks" aside={<PanelNote>{scopeLabel}</PanelNote>}>
			<PanelBody className="py-1.5 text-sm">
				{rows.map((row) => (
					<div key={row.productId} className={ROW}>
						<div>
							{row.productName}{" "}
							<span className="text-muted-foreground tabular-nums">
								× {formatCount(row.quantity)}
							</span>
						</div>
						<div className="text-right font-medium tabular-nums">
							{row.revenueOre > 0 ? formatNok(row.revenueOre) : NO_FIXED_PRICE_LABEL}
						</div>
						<div className="col-span-full">
							<ShareBar
								share={totalOre > 0 ? (row.revenueOre / totalOre) * 100 : 0}
								color={SERIES_COLORS[row.category]}
							/>
						</div>
					</div>
				))}
				<div className={`${ROW} font-semibold`}>
					<div>Totalt</div>
					<div className="text-right tabular-nums">{formatNok(totalOre)}</div>
				</div>
			</PanelBody>
		</Panel>
	);
}
