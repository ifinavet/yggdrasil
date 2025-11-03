"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { DataTable } from "../common/tables/table";

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

	const defaultData = useMemo(() => [], []);

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
			<DataTable
				columns={createColumns}
				data={students ?? defaultData}
				onRowClick={handleRowClick}
			/>
		</div>
	);
}
