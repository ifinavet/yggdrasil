"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	type PaginationState,
	type Row,
	useReactTable,
} from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@workspace/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { usePersistentState } from "@/hooks/use-persitent-state";
import { getAllStudentsPaged, getStudentsTableMetadata } from "@/lib/queries/students";

type StudentsTableColumns = {
	user_id: string;
	name: string;
	email: string;
	status: string;
	program: string;
	semester: number;
};

const createColumns: ColumnDef<StudentsTableColumns>[] = [
	{
		id: "name",
		accessorKey: "name",
		header: "Navn",
	},
	{
		id: "email",
		accessorKey: "email",
		header: "E-post",
	},
	{
		id: "status",
		header: "Status",
		cell: ({ row }) => {
			const status = row.original.status;
			const color =
				status === "Ukjent"
					? "bg-yellow-100 text-yellow-800"
					: status === "Aktiv"
						? "bg-green-100 text-green-800"
						: "bg-red-100 text-red-800";
			return (
				<span className={`rounded-full px-2 py-1 font-medium text-xs ${color}`}>{status}</span>
			);
		},
	},
	{
		accessorKey: "program",
		header: "Studieprogram",
	},
	{
		accessorKey: "semester",
		header: "Semester",
	},
];

export default function StudentsOverview() {
	const [pagination, setPage] = usePersistentState<PaginationState>("pagination", {
		pageIndex: 0,
		pageSize: 25,
	});

	const { data: rowCount } = useQuery({
		queryKey: ["students-metadata"],
		queryFn: () => getStudentsTableMetadata(),
		placeholderData: keepPreviousData,
	});

	const { data } = useQuery({
		queryKey: ["students", pagination],
		queryFn: () => getAllStudentsPaged(pagination),
		placeholderData: keepPreviousData,
	});

	const columns = createColumns;

	const defaultData = useMemo(() => [], []);

	const table = useReactTable({
		data: (data as StudentsTableColumns[]) ?? defaultData,
		columns,
		state: {
			pagination,
		},
		rowCount: rowCount ?? 0,
		getCoreRowModel: getCoreRowModel(),
		onPaginationChange: setPage,
		manualPagination: true,
	});

	const router = useRouter();

	const handleRowClick = useCallback(
		(row: Row<StudentsTableColumns>) => {
			if (row.original.user_id) {
				router.push(`/students/${row.original.user_id}`);
			}
		},
		[router],
	);

	return (
		<div className='flex flex-col gap-4'>
			<div className='mb-4 flex w-full items-center justify-between'>
				<div className='flex items-center gap-2'>
					<p className='w-full'>Viser rader per side:</p>
					<Select
						onValueChange={(newValue) =>
							setPage({
								...pagination,
								pageSize: Number.parseInt(newValue),
							})
						}
					>
						<SelectTrigger>{pagination.pageSize} rader</SelectTrigger>
						<SelectContent>
							<SelectItem value='15'>15 rader</SelectItem>
							<SelectItem value='25'>25 rader</SelectItem>
							<SelectItem value='35'>35 rader</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className='flex gap-4'>
					<Button
						type='button'
						variant='outline'
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Forrige
					</Button>
					<Button
						type='button'
						variant='outline'
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Neste
					</Button>
				</div>
			</div>

			<div className='overflow-clip rounded-md border'>
				<Table>
					<TableHeader className='bg-accent'>
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
						{table.getCoreRowModel().rows?.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
								className='cursor-pointer hover:bg-muted/50'
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
		</div>
	);
}
