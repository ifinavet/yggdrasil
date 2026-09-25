"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

type SegmentedControlProps = Omit<
	React.ComponentProps<typeof ToggleGroupPrimitive.Root>,
	"type" | "defaultValue" | "value" | "onValueChange"
> & {
	value: string;
	onValueChange: (value: string) => void;
};

function SegmentedControl({ className, value, onValueChange, ...rootProps }: SegmentedControlProps) {
	return (
		<ToggleGroupPrimitive.Root
			data-slot='segmented-control'
			type='single'
			value={value}
			onValueChange={(nextValue) => {
				if (nextValue) onValueChange(nextValue);
			}}
			className={cn("inline-grid grid-flow-col rounded-md bg-muted p-[3px]", className)}
			{...rootProps}
		/>
	);
}

function SegmentedControlItem({
	className,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
	return (
		<ToggleGroupPrimitive.Item
			data-slot='segmented-control-item'
			className={cn(
				"cursor-pointer whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-muted-foreground text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs",
				className,
			)}
			{...props}
		/>
	);
}

export { SegmentedControl, SegmentedControlItem };
