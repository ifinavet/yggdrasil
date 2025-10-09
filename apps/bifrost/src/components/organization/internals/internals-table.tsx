"use client";

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components//table";

interface InternalsTableProps<TData, TValue> {
	className?: string;
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	empty_message?: string;
}

export function InternalsTable<TData, TValue>({
	className,
	columns,
	data,
	empty_message = "Ingen interne funnet",
}: InternalsTableProps<TData, TValue>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<Table className={className}>
			<TableHeader className="bg-accent font-bold">
				{table.getHeaderGroups().map((headerGroup) => (
					<TableRow key={headerGroup.id}>
						{headerGroup.headers.map((header) => (
							<TableHead key={header.id} className="text-bold">
								{header.isPlaceholder
									? null
									: flexRender(header.column.columnDef.header, header.getContext())}
							</TableHead>
						))}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getCoreRowModel().rows?.length ? (
					table.getCoreRowModel().rows.map((row) => (
						<TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))
				) : (
					<TableRow>
						<TableCell colSpan={columns.length} className="text-center">
							{empty_message}
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	);
}
