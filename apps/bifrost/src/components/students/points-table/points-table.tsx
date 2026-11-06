"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import BaseDataTable, { type DataTableFeatures } from "@/components/common/tables/data-table";

export function PointsTable<TData extends RowData>({
	columns,
	data,
	empty_message = "Ingen prikker funnet",
}: Readonly<{
	columns: ColumnDef<DataTableFeatures, TData>[];
	data: TData[];
	empty_message?: string;
}>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage={empty_message}
			styles={{ container: "overflow-clip rounded-md border" }}
		/>
	);
}
