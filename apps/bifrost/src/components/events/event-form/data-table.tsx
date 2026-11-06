"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import BaseDataTable, { type DataTableFeatures } from "@/components/common/tables/data-table";

export default function OrganizersTable<TData extends RowData>({
	columns,
	data,
}: Readonly<{ columns: ColumnDef<DataTableFeatures, TData>[]; data: TData[] }>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage="Ingen ansvarlige er lagt til."
			styles={{ container: "rounded-md border", emptyCell: "h-24" }}
		/>
	);
}
