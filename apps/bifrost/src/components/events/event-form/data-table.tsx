"use client";

import type { ColumnDef } from "@tanstack/react-table";
import BaseDataTable from "@/components/common/tables/data-table";

export default function OrganizersTable<TData, TValue>({
	columns,
	data,
}: Readonly<{ columns: ColumnDef<TData, TValue>[]; data: TData[] }>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage="Ingen ansvarlige er lagt til."
			styles={{ container: "rounded-md border", emptyCell: "h-24" }}
		/>
	);
}
