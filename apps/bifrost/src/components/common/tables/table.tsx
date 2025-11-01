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

interface DataTableProps<TData, TValue> {
	className?: string;
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	empty_message?: string;
	onRowClick?: (row: Row<TData>) => void;
}

export function DataTable<TData, TValue>({
	className,
	columns,
	data,
	onRowClick,
	empty_message = "Ingen data funnet.",
}: Readonly<DataTableProps<TData, TValue>>) {
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
									: flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)}
							</TableHead>
						))}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getCoreRowModel().rows?.length ? (
					table.getCoreRowModel().rows.map((row) => (
						<TableRow
							key={row.id}
							data-state={row.getIsSelected() && "selected"}
							className={`${onRowClick && "cursor-pointer"} hover:bg-muted/50`}
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
						<TableCell colSpan={columns.length} className="text-center">
							{empty_message}
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	);
}
