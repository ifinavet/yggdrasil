import { Input } from "@workspace/ui/components/input";
import type { ComponentProps } from "react";

export function AffixInput({ affix, ...props }: Readonly<ComponentProps<"input"> & { affix: string }>) {
	return (
		<div className="relative">
			<Input className="pr-11 tabular-nums" {...props} />
			<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted-foreground">
				{affix}
			</span>
		</div>
	);
}
