"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div data-slot='table-container' className='relative w-full overflow-x-auto'>
			<table
				data-slot='table'
				className={cn("w-full caption-bottom text-sm", className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return <thead data-slot='table-header' className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot='table-body'
			className={cn("[&_tr:last-child]:border-0", className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot='table-footer'
			className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
			{...props}
		/>
	);
}

type TableRowMarker = { label: string; className: string };

type CellProps = { className?: string; children?: React.ReactNode };

function TableRowMarkerLabel({ marker }: { marker: TableRowMarker }) {
	return (
		<span
			data-slot='table-row-marker'
			className={cn(
				"group/marker absolute inset-y-0 left-0 z-10 flex w-max max-w-1.5 items-center overflow-hidden p-0 transition-[max-width] duration-150 ease-out hover:max-w-56",
				marker.className,
			)}
		>
			<span className='whitespace-nowrap px-3 font-medium text-xs opacity-0 transition-opacity group-hover/marker:opacity-100'>
				{marker.label}
			</span>
		</span>
	);
}

function withMarker(children: React.ReactNode, marker: TableRowMarker) {
	const [first, ...rest] = React.Children.toArray(children);
	if (!React.isValidElement<CellProps>(first)) return children;
	return [
		React.cloneElement(first, {
			key: first.key,
			className: cn("relative", first.props.className),
			children: (
				<>
					<TableRowMarkerLabel marker={marker} />
					{first.props.children}
				</>
			),
		}),
		...rest,
	];
}

function TableRow({
	className,
	marker,
	children,
	...props
}: React.ComponentProps<"tr"> & { marker?: TableRowMarker | null }) {
	return (
		<tr
			data-slot='table-row'
			className={cn(
				"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
				className,
			)}
			{...props}
		>
			{marker ? withMarker(children, marker) : children}
		</tr>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot='table-head'
			className={cn(
				"h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot='table-cell'
			className={cn(
				"whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot='table-caption'
			className={cn("mt-4 text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
export type { TableRowMarker };
