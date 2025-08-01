"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type StudentColumns = Doc<"students"> & {
  status: "Aktiv" | "Ukjent" | "Ikke registrert";
}

const createColumns: ColumnDef<StudentColumns>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Navn",
  },
  {
    id: "email",
    accessorKey: "email",
    header: "E-post",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const color =
        status === "Ukjent"
          ? "bg-yellow-100 text-yellow-800"
          : status === "Aktiv"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800";
      return (
        <span className={`rounded-full px-2 py-1 font-medium text-xs ${color}`}>{status}</span>
      );
    },
  },
  {
    accessorKey: "studyProgram",
    header: "Studieprogram",
  },
  {
    accessorKey: "semester",
    header: "Semester",
  },
];

export default function StudentsOverview() {
  const {
    results: students,
    status,
    loadMore,
  } = usePaginatedQuery(api.students.getAllPaged, {}, { initialNumItems: 25 });

  const columns = createColumns as ColumnDef<Doc<"students"> & { status: string }>[];

  const defaultData = useMemo(() => [], []);

  const table = useReactTable({
    data: students ?? defaultData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const router = useRouter();

  const handleRowClick = useCallback(
    (row: Row<Doc<"students">>) => {
      if (row.original._id) {
        router.push(`/students/${row.original._id}`);
      }
    },
    [router],
  );

  return (
    <div className='flex flex-col gap-4'>
      <div className='overflow-clip rounded-md border'>
        <Table>
          <TableHeader className='bg-accent'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getCoreRowModel().rows?.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className='cursor-pointer hover:bg-muted/50'
                onClick={() => handleRowClick(row)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button onClick={() => loadMore(25)} disabled={status !== "CanLoadMore"} className='w-fit self-center'>
        Last inn flere studenter
      </Button>
    </div>
  );
}
