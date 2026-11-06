"use client";

import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import type { ReactNode } from "react";
import BaseDataTable, { type DataTableFeatures } from "@/components/common/tables/data-table";

export function DataTable<TData extends RowData>({
	className,
	columns,
	data,
	onRowClick,
	renderExpanded,
	empty_message = "Ingen data funnet.",
}: Readonly<{
	className?: string;
	columns: ColumnDef<DataTableFeatures, TData>[];
	data: TData[];
	empty_message?: string;
	onRowClick?: (row: Row<DataTableFeatures, TData>) => void;
	renderExpanded?: (row: Row<DataTableFeatures, TData>) => ReactNode;
}>) {
	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage={empty_message}
			onRowClick={onRowClick}
			renderExpanded={renderExpanded}
			styles={{
				table: className,
				header: "bg-accent font-bold",
				head: "font-bold",
				row: "hover:bg-muted/50",
				expanded: "bg-muted/30",
			}}
		/>
	);
}
