"use client";

import type { ColumnDef } from "@tanstack/react-table";

export type Organizer = {
  id: string;
  name: string;
  role: string;
};

export const columns: ColumnDef<Organizer>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "role",
    header: "Rolle",
  },
];
