import { FieldSet } from "@workspace/ui/components/field";
import { type ReactNode, useId } from "react";

export function OrderSection({
	id,
	legend,
	action,
	children,
}: Readonly<{ id?: string; legend: string; action?: ReactNode; children: ReactNode }>) {
	const headingId = useId();
	return (
		<FieldSet
			id={id}
			aria-labelledby={headingId}
			className="min-w-0 gap-4 border-t pt-6 first:border-t-0 first:pt-0"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2
					id={headingId}
					className="font-semibold text-lg text-primary dark:text-primary-foreground"
				>
					{legend}
				</h2>
				{action}
			</div>
			<div className="flex w-full flex-col gap-5">{children}</div>
		</FieldSet>
	);
}
