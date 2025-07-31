"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components//button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components//select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Trash } from "lucide-react";
import { humanReadableDate } from "@/utils/utils";

export type Registration = {
  registrationId: Id<"registrations">;
  userName: string;
  note: string;
  registrationTime: Date;
  attendanceStatus: string;
};

export const createColumns = (
  onDelete: (registrationId: Id<"registrations">) => void,
  onRegister: (registrationId: Id<"registrations">, newStatus: string) => void,
): ColumnDef<Registration>[] => [
    {
      accessorKey: "userName",
      header: "Navn",
    },
    {
      accessorKey: "note",
      header: "Bemærkninger",
    },
    {
      accessorKey: "registrationTime",
      header: "Påmeldings tidspunkt",
      cell: ({ row }) => {
        return <>{humanReadableDate(row.original.registrationTime)}</>;
      },
    },
    {
      accessorKey: "attendanceStatus",
      header: "Status",
      cell: ({ row }) => {
        return (
          <Select
            defaultValue={row.original.attendanceStatus ?? ""}
            onValueChange={(value) => onRegister(row.original.registrationId, value)}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Registrer påmeldte' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='confirmed'>Oppmøtt</SelectItem>
              <SelectItem value='late'>Møtt sent</SelectItem>
              <SelectItem value='no_show'>Ikke møtt</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='destructive' size='icon'>
                <Trash className='size-4' />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
              <AlertDialogDescription>
                Du vil slette denne påmeldingen? Dette er en irreversibel handling, og vil bli
                loggført.
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(row.original.registrationId)}>
                  Slett
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];
