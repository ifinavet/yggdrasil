"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { DATE_PATTERNS, eventSemesterOf, formatOsloDate } from "@workspace/shared/time";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
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
import { useRef, useState } from "react";
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import {
	attendanceRate,
	fillShare,
	formatShare,
	type PastEvent,
	semesterLabel,
	semesterValue,
	startedSemesters,
} from "./engagement-format";
import { EventAudience } from "./event-audience";
import { PaceChart } from "./pace-chart";

function PastTable({
	events,
	selectedId,
	onSelect,
}: Readonly<{
	events: PastEvent[];
	selectedId: Id<"events"> | null;
	onSelect: (eventId: Id<"events">) => void;
}>) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={`${LIST_HEAD} w-[90px]`}>Dato</TableHead>
					<TableHead className={LIST_HEAD}>Arrangement</TableHead>
					<TableHead className={LIST_HEAD}>Påmeldte</TableHead>
					<TableHead className={`${LIST_HEAD} text-right`}>Oppmøte</TableHead>
					<TableHead className={`${LIST_HEAD} text-right`}>Sene avmeldinger</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{events.map((event) => {
					const rate = attendanceRate(event);
					return (
						<TableRow
							key={event._id}
							data-state={event._id === selectedId ? "selected" : undefined}
							className="relative"
						>
							<TableCell className={`${LIST_CELL} whitespace-nowrap tabular-nums`}>
								{formatOsloDate(event.eventStart, DATE_PATTERNS.shortDate)}
							</TableCell>
							<TableCell className={LIST_CELL}>
								<div className="flex min-w-0 items-center gap-3">
									<CompanyLogo name={event.companyName} url={event.companyLogoUrl} />
									<div>
										<button
											type="button"
											onClick={() => onSelect(event._id)}
											className="block text-left font-medium after:absolute after:inset-0"
										>
											{event.title}
										</button>
										<span className="block text-muted-foreground text-xs">{event.companyName}</span>
									</div>
								</div>
							</TableCell>
							<TableCell className={LIST_CELL}>
								<div className="whitespace-nowrap tabular-nums">
									{event.registered} / {event.participationLimit}
									<div className="mt-1.5 w-24">
										<ShareBar
											share={fillShare(event.registered, event.participationLimit)}
											color={PRIMARY_SERIES_COLOR}
										/>
									</div>
								</div>
							</TableCell>
							<TableCell className={`${LIST_CELL} text-right tabular-nums`}>
								{rate === null ? (
									<span className="text-muted-foreground">Ikke registrert</span>
								) : (
									formatShare(rate)
								)}
							</TableCell>
							<TableCell className={`${LIST_CELL} text-right tabular-nums`}>
								{event.lateUnregistrations ?? (
									<span className="text-muted-foreground">Ikke logget</span>
								)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

export function PastView({ now }: Readonly<{ now: number }>) {
	const semesters = useQuery(api.events.queries.getPossibleSemesters);
	const [selected, setSelected] = useState(() => eventSemesterOf(now));
	const events = useQuery(api.engagement.queries.past, { now, ...selected });
	const [picked, setPicked] = useState<Id<"events"> | null>(null);
	const paceRef = useRef<HTMLDivElement>(null);
	const options = semesters ? startedSemesters(semesters, now) : [selected];

	const selectedId =
		picked && events?.some((event) => event._id === picked) ? picked : (events?.[0]?._id ?? null);
	const openEvent = (eventId: Id<"events">) => {
		setPicked(eventId);
		paceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="grid gap-4">
			<Panel
				title="Gjennomførte arrangementer"
				aside={
					<Select
						value={semesterValue(selected)}
						onValueChange={(value) => {
							const option = options.find((candidate) => semesterValue(candidate) === value);
							if (option) setSelected(option);
						}}
					>
						<SelectTrigger size="sm" aria-label="Semester">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.map((option) => (
								<SelectItem key={semesterValue(option)} value={semesterValue(option)}>
									{semesterLabel(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			>
				{!events ? (
					<PanelBody>
						<Skeleton className="h-48 w-full" />
					</PanelBody>
				) : events.length ? (
					<PastTable events={events} selectedId={selectedId} onSelect={openEvent} />
				) : (
					<PanelBody>
						<PanelNote>Ingen gjennomførte arrangementer dette semesteret.</PanelNote>
					</PanelBody>
				)}
			</Panel>
			<div ref={paceRef} className="grid scroll-mt-4 gap-4">
				{selectedId && (
					<>
						<PaceChart
							eventId={selectedId}
							now={now}
							note="Viser arrangementet du klikker på i tabellen. Typisk forløp bygger på arrangementene før dette."
						/>
						<EventAudience eventId={selectedId} />
					</>
				)}
			</div>
		</div>
	);
}
