import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Trash } from "lucide-react";
import { useState } from "react";
import type { accessRights } from "@/constants/types";
import UpsertInternalRole from "./upsert-internal-role";

export type InternalsTable = {
	internalId: Id<"internals">;
	userId: Id<"users">;
	fullName: string;
	email: string;
	group: string;
	role: typeof accessRights;
};

export const createColumns = (
	onDelete: (internalsId: Id<"internals">) => void,
	onUpdateGroup: (internalsId: Id<"internals">, group: string) => void,
	onSetRole: (userId: Id<"users">, role: typeof accessRights) => void,
): ColumnDef<InternalsTable>[] => [
		{
			accessorKey: "fullName",
			header: "Navn",
		},
		{
			accessorKey: "email",
			header: "E-post",
		},
		{
			accessorKey: "group",
			header: "Gruppe",
			cell: ({ row }) => {
				const internalsId = row.original.internalId;
				const initialGroup = row.original.group;
				const [localGroup, setLocalGroup] = useState(initialGroup);

				const handleBlur = () => {
					if (localGroup !== initialGroup) {
						onUpdateGroup(internalsId, localGroup);
					}
				};

				return (
					<Input
						type='text'
						placeholder='eks. webgruppen 🦖'
						value={localGroup}
						onChange={(e) => setLocalGroup(e.target.value)}
						onBlur={handleBlur}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.currentTarget.blur();
							}
						}}
					/>
				);
			},
		},
		{
			accessorKey: "role",
			header: "Rolle",
			cell: ({ row }) => {
				return (
					<UpsertInternalRole
						role={row.original.role}
						setSelectedRoleAction={(newRole) => onSetRole(row.original.userId, newRole as unknown as typeof accessRights)}
					/>
				);
			},
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<div className='flex gap-2'>
					<Button variant='destructive' size='icon' onClick={() => onDelete(row.original.internalId)}>
						<Trash className='size-4' />
					</Button>
				</div>
			),
		},
	];
