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
import { useRouter } from "next/navigation";

interface RegistrationsTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	empty_message?: string;
}

export function ListingsTable<TData, TValue>({
	columns,
	data,
	empty_message = "Ingen aktive stillingsannonser funnet",
}: RegistrationsTableProps<TData, TValue>) {
	const router = useRouter();

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const handleRowClick = (row: Row<TData>) => {
		// biome-ignore lint: Artifact of being an generic type
		if ((row.original as any)?.listingId) {
			// biome-ignore lint: Artifact of being an generic type
			router.push(`/job-listings/${(row.original as any).listingId}`);
		}
	};

	return (
		<div className="rounded-md">
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id}>
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
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
								className="cursor-pointer hover:bg-muted/50"
								onClick={() => handleRowClick(row)}
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
		</div>
	);
}
