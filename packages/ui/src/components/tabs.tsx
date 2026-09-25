"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const tabsListVariants = cva("flex w-fit items-center text-muted-foreground", {
	variants: {
		variant: {
			pill: "inline-flex h-9 justify-center rounded-lg bg-muted p-[3px]",
			underline: "items-end gap-1 border-b",
		},
	},
	defaultVariants: { variant: "pill" },
});

const tabsTriggerVariants = cva(
	"inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium text-sm transition-[color,box-shadow] focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				pill: "h-[calc(100%-1px)] flex-1 rounded-md border border-transparent px-2 py-1 text-foreground focus-visible:border-ring data-[state=active]:bg-background data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
				underline:
					"-mb-px border-transparent border-b-2 px-4 py-2.5 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
			},
		},
		defaultVariants: { variant: "pill" },
	},
);

type TabsVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>;

const TabsVariantContext = React.createContext<TabsVariant>("pill");

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot='tabs'
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

function TabsList({
	className,
	variant = "pill",
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
	return (
		<TabsVariantContext.Provider value={variant}>
			<TabsPrimitive.List
				data-slot='tabs-list'
				data-variant={variant}
				className={cn(tabsListVariants({ variant }), className)}
				{...props}
			/>
		</TabsVariantContext.Provider>
	);
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	const variant = React.useContext(TabsVariantContext);
	return (
		<TabsPrimitive.Trigger
			data-slot='tabs-trigger'
			className={cn(tabsTriggerVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot='tabs-content'
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
