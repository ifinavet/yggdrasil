"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import type { ReactNode } from "react";
import BaseDataTable from "@/components/common/tables/data-table";

export function DataTable<TData, TValue>({
	className,
	columns,
	data,
	onRowClick,
	renderExpanded,
	empty_message = "Ingen data funnet.",
}: Readonly<{
	className?: string;
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	empty_message?: string;
	onRowClick?: (row: Row<TData>) => void;
	renderExpanded?: (row: Row<TData>) => ReactNode;
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
