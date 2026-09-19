"use client";

import type { ColumnDef } from "@tanstack/react-table";
import BaseDataTable from "@/components/common/tables/data-table";

export function PointsTable<TData, TValue>({
	columns,
	data,
	empty_message = "Ingen prikker funnet",
}: Readonly<{ columns: ColumnDef<TData, TValue>[]; data: TData[]; empty_message?: string }>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage={empty_message}
			styles={{ container: "overflow-clip rounded-md border" }}
		/>
	);
}
