"use client";

import type { ColumnDef } from "@tanstack/react-table";
import BaseDataTable from "@/components/common/tables/data-table";

export function ContactsTable<TData, TValue>({
	columns,
	data,
}: Readonly<{ columns: ColumnDef<TData, TValue>[]; data: TData[] }>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage="Ingen kontakter lagt til."
			styles={{ container: "rounded-md border" }}
		/>
	);
}
