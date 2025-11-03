"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DataTable } from "../common/tables/table";

type StudentColumns = {
	id: string;
	name: string;
	status: "Aktiv" | "Låst" | "Ikke registrert";
	program: string;
	year: number;
};

const statusColors = {
	"Ikke registrert": "bg-yellow-100 text-yellow-800",
	Aktiv: "bg-green-100 text-green-800",
	Låst: "bg-red-100 text-red-800",
} as const;

const columns: ColumnDef<StudentColumns>[] = [
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
		id: "status",
		header: "Status",
		cell: ({ row }) => {
			const status = row.original.status;
			const color =
				statusColors[status as keyof typeof statusColors] ||
				"bg-gray-100 text-gray-800";
			return (
				<span className={`rounded-full px-2 py-1 font-medium text-xs ${color}`}>
					{status}
				</span>
			);
		},
	},
	{
		accessorKey: "program",
		header: "Studieprogram",
	},
	{
		accessorKey: "year",
		header: "År",
	},
];

export default function StudentsOverview() {
	const [search, setSearch] = useState("");

	const {
		results: students,
		status,
		loadMore,
	} = usePaginatedQuery(
		api.students.getAllPaged,
		{ search },
		{ initialNumItems: 25 },
	);

	const router = useRouter();

	const data = students.map((student) => ({
		id: student._id,
		name: student.name,
		status: student.status,
		program: student.studyProgram,
		year: student.year,
	})) as StudentColumns[];

	const handleRowClick = useCallback(
		(row: Row<StudentColumns>) => {
			if (row.original.id) {
				router.push(`/students/${row.original.id}`);
			}
		},
		[router],
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-2">
				<Label htmlFor="search">Søk etter student</Label>
				<Input
					type="text"
					id="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="eks. Ola nordmann..."
					className="max-w-[80ch]"
				/>
			</div>
			<div className="overflow-clip rounded-md border">
				<DataTable columns={columns} data={data} onRowClick={handleRowClick} />
			</div>
			<Button
				onClick={() => loadMore(25)}
				disabled={status !== "CanLoadMore"}
				className="w-fit self-center"
			>
				Last inn flere studenter
			</Button>
		</div>
	);
}
