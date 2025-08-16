"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { JobListing } from "@/utils/job-listings";
import { humanReadableDate } from "@/utils/utils";

export const createColumns: ColumnDef<JobListing>[] = [
	{
		accessorKey: "title",
		header: "Tittel",
	},
	{
		accessorKey: "published",
		header: "Status",
		cell: ({ row }) => (
			<span
				className={`rounded-full px-2 py-1 font-medium text-xs ${
					row.original.published ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
				}`}
			>
				{row.original.published ? "Publisert" : "Upublisert"}
			</span>
		),
	},
	{
		accessorKey: "type",
		header: "Stillings type",
	},
	{
		accessorKey: "companyName",
		header: "Bedrift",
	},
	{
		accessorKey: "deadline",
		header: "Deadline",
		cell: ({ row }) => humanReadableDate(row.original.deadline),
	},
];
