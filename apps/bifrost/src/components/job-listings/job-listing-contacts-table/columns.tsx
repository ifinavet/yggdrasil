"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { Trash2 } from "lucide-react";

export type JobListingContact = {
  name: string,
  email: string,
  phone: string,
};

export const createColumns = (onDelete: (index: number) => void): ColumnDef<JobListingContact>[] => [
  {
    accessorKey: "name",
    header: "Navn",
  },
  {
    accessorKey: "email",
    header: "E-post",
  },
  {
    accessorKey: "phone",
    header: "Telefon",
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Button
        variant="destructive"
        size="icon"
        onClick={() => onDelete(row.index)}
      >
        <Trash2 />
      </Button>
    ),
  }
];
