"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
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
import type { ReactNode } from "react";

export type DataTableStyles = {
	readonly container?: string;
	readonly table?: string;
	readonly header?: string;
	readonly head?: string;
	readonly row?: string;
	readonly emptyCell?: string;
};

export default function BaseDataTable<TData, TValue>({
	columns,
	data,
	emptyMessage,
	styles = {},
	onRowClick,
}: Readonly<{
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	emptyMessage: ReactNode;
	styles?: DataTableStyles;
	onRowClick?: (row: Row<TData>) => void;
}>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const rows = table.getCoreRowModel().rows;

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
					rows.map((row) => (
						<TableRow
							key={row.id}
							data-state={row.getIsSelected() && "selected"}
							className={cn(onRowClick && "cursor-pointer", styles.row)}
							onClick={onRowClick ? () => onRowClick(row) : undefined}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))
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
