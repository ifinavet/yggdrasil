"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { humanReadableDate } from "@/utils/utils";

export type JobListing = {
  listing_id: number,
  title: string,
  deadline: Date,
};

export const createColumns: ColumnDef<JobListing>[] = [
  {
    accessorKey: "title",
    header: "Tittel",
  },
  {
    accessorKey: "deadline",
    header: "Deadline",
    cell: ({ row }) => humanReadableDate(row.original.deadline),
  },
];
