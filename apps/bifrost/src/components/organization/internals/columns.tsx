import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "@workspace/backend/convex/dataModel";
import type { ACCESS_RIGHTS } from "@workspace/shared/constants";
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
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronRight, Trash } from "lucide-react";
import { useState } from "react";
import type { Connections } from "./connections";
import UpsertInternalRole from "./upsert-internal-role";

export type InternalsTable = {
	internalId: Id<"internals">;
	userId: Id<"users">;
	fullName: string;
	email: string;
	group: string;
	role: (typeof ACCESS_RIGHTS)[number];
	connections: Connections | null;
};

function GroupInput({
	initialGroup,
	onSave,
}: Readonly<{ initialGroup: string; onSave: (group: string) => void }>) {
	const [localGroup, setLocalGroup] = useState(initialGroup);

	return (
		<Input
			className="md:w-1/2"
			type="text"
			placeholder="eks. webgruppen 🦖"
			value={localGroup}
			onChange={(e) => setLocalGroup(e.target.value)}
			onBlur={() => {
				if (localGroup !== initialGroup) onSave(localGroup);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.currentTarget.blur();
				}
			}}
		/>
	);
}

export const createColumns = (
	onDelete: (internalsId: Id<"internals">) => void,
	onUpdateGroup: (internalsId: Id<"internals">, group: string) => void,
	onSetRole: (userId: Id<"users">, role: (typeof ACCESS_RIGHTS)[number]) => void,
): ColumnDef<InternalsTable>[] => [
	{
		id: "expand",
		header: () => <span className="sr-only">Detaljer</span>,
		cell: ({ row }) => (
			<Button
				variant="ghost"
				size="icon"
				className="size-8"
				aria-expanded={row.getIsExpanded()}
				aria-label={`Vis detaljer for ${row.original.fullName}`}
				onClick={row.getToggleExpandedHandler()}
			>
				<ChevronRight
					aria-hidden
					className={cn(
						"transition-transform duration-200 ease-out motion-reduce:transition-none",
						row.getIsExpanded() && "rotate-90",
					)}
				/>
			</Button>
		),
	},
	{
		id: "index",
		header: "#",
		cell: ({ row }) => {
			return <span>{row.index + 1}</span>;
		},
	},
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
		cell: ({ row }) => (
			<GroupInput
				key={row.original.internalId}
				initialGroup={row.original.group}
				onSave={(group) => onUpdateGroup(row.original.internalId, group)}
			/>
		),
	},
	{
		accessorKey: "role",
		header: "Rolle",
		cell: ({ row }) => {
			return (
				<UpsertInternalRole
					role={row.original.role as unknown as string}
					setSelectedRoleAction={(newRole) =>
						onSetRole(row.original.userId, newRole as (typeof ACCESS_RIGHTS)[number])
					}
				/>
			);
		},
	},
	{
		id: "actions",
		cell: ({ row }) => (
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button variant="destructive" size="icon" aria-label={`Fjern ${row.original.fullName}`}>
						<Trash className="size-4" />
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogTitle>Fjerne {row.original.fullName}?</AlertDialogTitle>
					<AlertDialogDescription>
						Google-kontoen blir suspendert og tilgangen til Bifrost fjernes. Slack-kontoen må du
						deaktivere selv etterpå.
					</AlertDialogDescription>
					<AlertDialogFooter>
						<AlertDialogCancel>Avbryt</AlertDialogCancel>
						<AlertDialogAction onClick={() => onDelete(row.original.internalId)}>
							Fjern
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		),
	},
];
