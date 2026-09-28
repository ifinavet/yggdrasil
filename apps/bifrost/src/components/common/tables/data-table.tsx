"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	type Row,
	useReactTable,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components//table";
import { cn } from "@workspace/ui/lib/utils";
import { Fragment, type ReactNode } from "react";
import { isRowClick } from "./row-click";

export type DataTableStyles = {
	readonly container?: string;
	readonly table?: string;
	readonly header?: string;
	readonly head?: string;
	readonly row?: string;
	readonly emptyCell?: string;
	readonly expanded?: string;
};

export default function BaseDataTable<TData, TValue>({
	columns,
	data,
	emptyMessage,
	styles = {},
	onRowClick,
	renderExpanded,
}: Readonly<{
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	emptyMessage: ReactNode;
	styles?: DataTableStyles;
	onRowClick?: (row: Row<TData>) => void;
	renderExpanded?: (row: Row<TData>) => ReactNode;
}>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getRowCanExpand: () => renderExpanded !== undefined,
	});

	const rows = table.getRowModel().rows;
	const clickRow = (row: Row<TData>) =>
		renderExpanded ? () => row.toggleExpanded() : onRowClick && (() => onRowClick(row));

	const rendered = (
		<Table className={styles.table}>
			<TableHeader className={styles.header}>
				{table.getHeaderGroups().map((headerGroup) => (
					<TableRow key={headerGroup.id}>
						{headerGroup.headers.map((header) => (
							<TableHead key={header.id} className={styles.head}>
								{header.isPlaceholder
									? null
									: flexRender(header.column.columnDef.header, header.getContext())}
							</TableHead>
						))}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{rows.length ? (
					rows.map((row) => {
						const onClick = clickRow(row);
						return (
							<Fragment key={row.id}>
								<TableRow
									data-state={row.getIsSelected() && "selected"}
									className={cn(onClick && "cursor-pointer", styles.row)}
									onClick={
										onClick
											? (event) => {
													if (isRowClick(event.currentTarget, event.target as Element)) onClick();
												}
											: undefined
									}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
								{renderExpanded && row.getIsExpanded() && (
									<TableRow className={cn("hover:bg-transparent", styles.expanded)}>
										<TableCell colSpan={row.getVisibleCells().length} className="whitespace-normal">
											<div className="sticky left-2 max-w-[calc(100vw-3rem)]">
												{renderExpanded(row)}
											</div>
										</TableCell>
									</TableRow>
								)}
							</Fragment>
						);
					})
				) : (
					<TableRow>
						<TableCell colSpan={columns.length} className={cn("text-center", styles.emptyCell)}>
							{emptyMessage}
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	);

	if (!styles.container) return rendered;

	return <div className={styles.container}>{rendered}</div>;
}
