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
import { Trash2 } from "lucide-react";
import { OrganizerType } from "@/shared/enums";

export type Organizer = {
	id: string;
	name: string;
	role: keyof typeof OrganizerType;
};

export const createColumns = (
	onRoleChange: (organizerId: string, newRole: keyof typeof OrganizerType) => void,
	onDelete: (organizerId: string) => void,
): ColumnDef<Organizer>[] => [
	{
		accessorKey: "name",
		header: "Navn",
	},
	{
		id: "role",
		accessorKey: "role",
		header: "Rolle",
		cell: ({ row }) => {
			return (
				<Select
					defaultValue={row.original.role}
					onValueChange={(value) =>
						onRoleChange(row.original.id, value as keyof typeof OrganizerType)
					}
				>
					<SelectTrigger className='w-[180px]'>
						<SelectValue placeholder='Ansvarlig type' />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(OrganizerType).map(([key, value]) => (
							<SelectItem key={key} value={key}>
								{value}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			return (
				<div className='text-right'>
					<Button
						variant='destructive'
						size='icon'
						onClick={() => onDelete(row.original.id)}
						title={`Fjern ${row.original.name} som arrangør`}
					>
						<Trash2 className='size-4' />
					</Button>
				</div>
			);
		},
	},
];
