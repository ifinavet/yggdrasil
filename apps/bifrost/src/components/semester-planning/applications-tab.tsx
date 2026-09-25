"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { EVENT_TYPE_SHORT_LABELS } from "@workspace/shared/semester/labels";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import BaseDataTable from "@/components/common/tables/data-table";
import { shortDayTitle, studentRange } from "./format";
import { isActiveStatus } from "./status";
import { StatusBadge } from "./status-badge";

type Row = Doc<"companyApplications"> & { responsibleName?: string };

const muted = <span className="text-muted-foreground">–</span>;

const columns: ColumnDef<Row>[] = [
	{
		header: "Bedrift",
		cell: ({ row }) => (
			<Link
				href={`/semesterplan/soknad/${row.original._id}`}
				className="font-semibold hover:underline"
				onClick={(event) => event.stopPropagation()}
			>
				{row.original.registry.name}
			</Link>
		),
	},
	{ header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
	{
		header: "Dato",
		cell: ({ row }) => {
			const { assignedDate, status } = row.original;
			return assignedDate && isActiveStatus(status) ? (
				<span className="tabular-nums">{shortDayTitle(assignedDate)}</span>
			) : (
				muted
			);
		},
	},
	{ header: "Type", cell: ({ row }) => EVENT_TYPE_SHORT_LABELS[row.original.eventType] },
	{
		header: "Studenter",
		cell: ({ row }) => {
			const { minStudents, maxStudents } = row.original;
			return <span className="tabular-nums">{studentRange(minStudents, maxStudents)}</span>;
		},
	},
	{ header: "Kontaktperson fra Navet", cell: ({ row }) => row.original.responsibleName ?? muted },
];

/** «Søknader»: every application in the semester, oldest first. A row opens the application. */
export function ApplicationsTab({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const router = useRouter();
	const applications = useQuery(api.semesterPlanning.applications.queries.listForSemester, {
		semesterId: semester._id,
	});
	const members = useQuery(api.users.organization.queries.getAll);

	const rows = useMemo<Row[] | undefined>(() => {
		if (!applications) return undefined;
		const names = new Map<Id<"users">, string>(
			(members ?? []).map((member) => [member.userId, member.fullName]),
		);
		return applications.map((application) => ({
			...application,
			responsibleName: application.responsibleUserId
				? names.get(application.responsibleUserId)
				: undefined,
		}));
	}, [applications, members]);

	if (!rows) {
		return (
			<div className="grid gap-2 rounded-xl border bg-card p-4">
				{[0, 1, 2, 3].map((index) => (
					<Skeleton key={index} className="h-9" />
				))}
			</div>
		);
	}

	return (
		<BaseDataTable
			columns={columns}
			data={rows}
			emptyMessage={<span className="text-muted-foreground">Ingen søknader ennå.</span>}
			onRowClick={(row) => router.push(`/semesterplan/soknad/${row.original._id}`)}
			styles={{
				container: "overflow-x-auto rounded-xl border bg-card shadow-xs",
				table: "text-[13.5px]",
				head: "whitespace-nowrap px-4",
				row: "hover:bg-primary-light/40 [&>td]:px-4 [&>td]:whitespace-nowrap",
				emptyCell: "py-10",
			}}
		/>
	);
}
