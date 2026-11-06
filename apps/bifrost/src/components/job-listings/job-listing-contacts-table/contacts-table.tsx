"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import BaseDataTable, { type DataTableFeatures } from "@/components/common/tables/data-table";

export function ContactsTable<TData extends RowData>({
	columns,
	data,
}: Readonly<{ columns: ColumnDef<DataTableFeatures, TData>[]; data: TData[] }>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage="Ingen kontakter lagt til."
			styles={{ container: "rounded-md border" }}
		/>
	);
}
