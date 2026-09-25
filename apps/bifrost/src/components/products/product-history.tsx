import type { api } from "@workspace/backend/convex/api";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import type { FunctionReturnType } from "convex/server";
import {
	formatChangeValue,
	PRODUCT_ACTION_LABELS,
	PRODUCT_FIELD_LABELS,
} from "./product-history-format";

type ProductChanges = FunctionReturnType<typeof api.products.queries.getWithChanges>["changes"];

export function ProductHistory({ changes }: Readonly<{ changes: ProductChanges }>) {
	return (
		<section className="max-w-2xl space-y-3">
			<h2 className="font-semibold text-lg">Endringslogg</h2>
			<ol className="space-y-3">
				{changes.map((change) => (
					<li key={change._id} className="rounded-md border p-3 text-sm">
						<p className="font-medium">
							{PRODUCT_ACTION_LABELS[change.action]}
							<span className="font-normal text-muted-foreground">
								{" "}
								{change.changedByName ?? "System"},{" "}
								{formatOsloDate(change._creationTime, DATE_PATTERNS.numericDate)}{" "}
								{formatOsloDate(change._creationTime, DATE_PATTERNS.time)}
							</span>
						</p>
						{change.action === "updated" && (
							<ul className="mt-2 space-y-1 text-muted-foreground">
								{change.changes.map(({ field, before, after }) => (
									<li key={field}>
										{PRODUCT_FIELD_LABELS[field] ?? field}: {formatChangeValue(field, before)} til{" "}
										{formatChangeValue(field, after)}
									</li>
								))}
							</ul>
						)}
					</li>
				))}
			</ol>
		</section>
	);
}
