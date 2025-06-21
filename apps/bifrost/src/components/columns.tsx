"use client";

import type { ColumnDef } from "@tanstack/react-table";
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
import { humanReadableDate } from "@/lib/utils";

export type Registration = {
	user_id: string;
	user_name: string;
	note: string;
	registration_time: Date;
	attendance_status: string;
};

export const createColumns = (
	onDelete: (user_id: string) => void,
	onRegister: (user_id: string, new_status: string) => void,
): ColumnDef<Registration>[] => [
	{
		accessorKey: "user_name",
		header: "Navn",
	},
	{
		accessorKey: "note",
		header: "Bemærkninger",
	},
	{
		accessorKey: "registration_time",
		header: "Påmeldings tidspunkt",
		cell: ({ row }) => {
			return <>{humanReadableDate(row.original.registration_time)}</>;
		},
	},
	{
		accessorKey: "attendance_status",
		header: "Status",
		cell: ({ row }) => {
			return (
				<Select
					defaultValue={row.original.attendance_status ?? ""}
					onValueChange={(value) => onRegister(row.original.user_id, value)}
				>
					<SelectTrigger className='w-[180px]'>
						<SelectValue placeholder='Registrer påmeldte' />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='attended'>Oppmøtt</SelectItem>
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
							<AlertDialogAction onClick={() => onDelete(row.original.user_id)}>
								Slett
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			);
		},
	},
];
