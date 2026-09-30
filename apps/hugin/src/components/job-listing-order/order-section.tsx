import { FieldLegend, FieldSet } from "@workspace/ui/components/field";
import type { ReactNode } from "react";

export function OrderSection({
	id,
	legend,
	action,
	children,
}: Readonly<{ id?: string; legend: string; action?: ReactNode; children: ReactNode }>) {
	return (
		<FieldSet id={id} className="border-t pt-8 first:border-t-0 first:pt-0">
			<div className="flex items-center justify-between gap-4">
				<FieldLegend className="mb-0 font-semibold text-lg text-primary dark:text-primary-foreground">
					{legend}
				</FieldLegend>
				{action}
			</div>
			<div className="flex w-full flex-col gap-5">{children}</div>
		</FieldSet>
	);
}
