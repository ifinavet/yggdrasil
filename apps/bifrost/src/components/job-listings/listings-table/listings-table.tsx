"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import BaseDataTable from "@/components/common/tables/data-table";

function listingIdOf<TData>(row: Row<TData>): string | undefined {
	const original = row.original as { listingId?: string } | null;
	return original?.listingId;
}

export function ListingsTable<TData, TValue>({
	columns,
	data,
	empty_message = "Ingen aktive stillingsannonser funnet",
}: Readonly<{ columns: ColumnDef<TData, TValue>[]; data: TData[]; empty_message?: string }>) {
	const router = useRouter();

	return (
		<BaseDataTable
			columns={columns}
			data={data}
			emptyMessage={empty_message}
			styles={{ container: "rounded-md", row: "hover:bg-muted/50" }}
			onRowClick={(row) => {
				const listingId = listingIdOf(row);
				if (listingId) router.push(`/job-listings/${listingId}`);
			}}
		/>
	);
}
