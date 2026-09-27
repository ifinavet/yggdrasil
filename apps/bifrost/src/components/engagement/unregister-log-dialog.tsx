"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { REGISTRATION_STATUS_LABELS } from "@workspace/shared/constants";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { placeholderKeys } from "@workspace/shared/utils";
import { Badge } from "@workspace/ui/components/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useQuery } from "convex/react";
import { STATS_CELL, STATS_HEAD } from "@/components/common/table-classes";
import { followUpNote, type UnregisterLog } from "./engagement-format";

type LogEntry = UnregisterLog["entries"][number];

function studentLabel({ studyProgram, year }: LogEntry) {
	if (!studyProgram) return "Ukjent student";
	return year ? `${studyProgram}, ${year}. klasse` : studyProgram;
}

function LogRows({ log }: Readonly<{ log: UnregisterLog | undefined }>) {
	if (!log) {
		return placeholderKeys("unregister-log-row", 4).map((key) => (
			<TableRow key={key}>
				<TableCell className={STATS_CELL} colSpan={4}>
					<Skeleton className="h-4 w-full" />
				</TableCell>
			</TableRow>
		));
	}
	return log.entries.map((entry) => (
		<TableRow key={entry._id}>
			<TableCell className={`${STATS_CELL} tabular-nums`}>
				{formatOsloDate(entry.at, DATE_PATTERNS.time)}
			</TableCell>
			<TableCell className={`${STATS_CELL} whitespace-normal`}>{studentLabel(entry)}</TableCell>
			<TableCell className={STATS_CELL}>
				{entry.fromStatus ? REGISTRATION_STATUS_LABELS[entry.fromStatus] : null}
			</TableCell>
			<TableCell className={`${STATS_CELL} text-right`}>
				{entry.movedTo ? <Badge variant="soft">Meldt på {entry.movedTo.title}</Badge> : null}
			</TableCell>
		</TableRow>
	));
}

export function UnregisterLogDialog({
	eventId,
	title,
	open,
	onOpenChange,
}: Readonly<{
	eventId: Id<"events">;
	title: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}>) {
	const log = useQuery(api.engagement.queries.unregisterLog, open ? { eventId } : "skip");
	const note = log ? followUpNote(log) : null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Avmeldinger, {title}</DialogTitle>
					{note && <DialogDescription>{note}</DialogDescription>}
				</DialogHeader>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className={STATS_HEAD}>Tid</TableHead>
							<TableHead className={STATS_HEAD}>Student</TableHead>
							<TableHead className={STATS_HEAD}>Fra status</TableHead>
							<TableHead className={STATS_HEAD}>Etterpå</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="text-sm">
						<LogRows log={log} />
					</TableBody>
				</Table>
			</DialogContent>
		</Dialog>
	);
}
