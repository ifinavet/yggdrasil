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
import { Trash2 } from "lucide-react";
import type { OrganizerRole } from "../../../constants/types";

export type Organizer = {
	id: Id<"users">;
	name: string;
	role: OrganizerRole;
};

export const createColumns = (
	onRoleChange: (userId: Id<"users">, newRole: OrganizerRole) => void,
	onDelete: (userId: Id<"users">) => void,
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
					onValueChange={(value) => onRoleChange(row.original.id, value as OrganizerRole)}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Ansvarlig type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="medhjelper">Medhjelper</SelectItem>
						<SelectItem value="hovedansvarlig">Hovedansvarlig</SelectItem>
					</SelectContent>
				</Select>
			);
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			return (
				<div className="text-right">
					<Button
						variant="destructive"
						size="icon"
						onClick={() => onDelete(row.original.id)}
						title={`Fjern ${row.original.name} som arrangør`}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			);
		},
	},
];
