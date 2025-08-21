"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components//button";
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
	pointId: Id<"points">;
	severity: number;
	reason: string;
	awardedTime: Date;
};

export const createColumns = (
	onDelete: (pointId: Id<"points">) => void,
): ColumnDef<Registration>[] => [
		{
			id: "index",
			header: "#",
			cell: ({ row }) => {
				return <span>{row.index + 1}</span>;
			}
		},
		{
			accessorKey: "awaredTime",
			header: "Tildelt tidspunkt",
			cell: ({ row }) => {
				return <>{humanReadableDate(row.original.awardedTime)}</>;
			},
		},
		{
			accessorKey: "reason",
			header: "Årsak",
		},
		{
			accessorKey: "severity",
			header: "Alvorlighet",
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
								Du vil slette denne prikken? Dette er en irreversibel handling, og vil bli loggført.
							</AlertDialogDescription>
							<AlertDialogFooter>
								<AlertDialogCancel>Avbryt</AlertDialogCancel>
								<AlertDialogAction onClick={() => onDelete(row.original.pointId)}>
									Slett
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				);
			},
		},
	];
