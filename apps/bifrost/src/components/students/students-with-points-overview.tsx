"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type Row,
	useReactTable,
} from "@tanstack/react-table";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type StudentColumns = {
	id: Id<"students">;
	name: string;
	points: number;
};

const createColumns: ColumnDef<StudentColumns>[] = [
	{
		id: "index",
		header: "#",
		cell: ({ row }) => {
			return <span>{row.index + 1}</span>;
		},
	},
	{
		id: "name",
		accessorKey: "name",
		header: "Navn",
	},
	{
		accessorKey: "points",
		header: "# Prikker",
	},
];

export default function StudentsWithPointsOverview() {
	const students = useQuery(api.students.getAllWithPoints);

	const columns = createColumns as ColumnDef<StudentColumns>[];

	const defaultData = useMemo(() => [], []);

	const table = useReactTable({
		data: students ?? defaultData,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const router = useRouter();

	const handleRowClick = useCallback(
		(row: Row<StudentColumns>) => {
			if (row.original.id) {
				router.push(`/students/${row.original.id}`);
			}
		},
		[router],
	);

	return (
		<div className="overflow-clip rounded-md border">
			<Table>
				<TableHeader className="bg-accent">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id}>
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
					{table.getCoreRowModel().rows?.map((row) => (
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
					))}
				</TableBody>
			</Table>
		</div>
	);
}
