"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import BaseDataTable from "@/components/common/tables/data-table";

export function DataTable<TData, TValue>({
	className,
	columns,
	data,
	onRowClick,
	empty_message = "Ingen data funnet.",
}: Readonly<{
	className?: string;
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	empty_message?: string;
	onRowClick?: (row: Row<TData>) => void;
}>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage={empty_message}
			onRowClick={onRowClick}
			styles={{
				table: className,
				header: "bg-accent font-bold",
				head: "text-bold",
				row: "hover:bg-muted/50",
			}}
		/>
	);
}
