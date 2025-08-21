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
import { Badge } from "@workspace/ui/components/badge";
import { Trash } from "lucide-react";
import { humanReadableDate } from "@/utils/utils";

export type Registration = {
	registrationId: Id<"registrations">;
	userName: string;
	note: string;
	status: string;
	registrationTime: Date;
	attendanceStatus: string;
};

export const createColumns = (
	onDelete: (registrationId: Id<"registrations">) => void,
	onRegister: (registrationId: Id<"registrations">, newStatus: string) => void,
): ColumnDef<Registration>[] => [
		{
			id: "index",
			header: "#",
			cell: ({ row }) => {
				return <span>{row.index + 1}</span>;
			}
		},
		{
			accessorKey: "userName",
			header: "Navn",
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const norwegian: Record<string, string> = {
					registered: "Registrert",
					pending: "Venter",
					waitlist: "På venteliste",
				};

				if (row.original.status === "pending") {
					return (
						<Badge variant='secondary' className='bg-amber-400'>
							Venter
						</Badge>
					);
				}
				if (row.original.status === "waitlist") {
					return <Badge variant='default' className="bg-pink-500">{norwegian[row.original.status]}</Badge>;
				}

				return <Badge variant='default'>{norwegian[row.original.status]}</Badge>;
			},
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
							<Button variant='destructive' size='icon' >
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
