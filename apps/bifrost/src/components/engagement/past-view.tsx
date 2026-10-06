"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Panel, PanelBody, PanelNote } from "@workspace/ui/components/products/panel";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useRef, useState } from "react";
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { organizerMarker } from "@/components/common/organizer-role";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import { useStableQuery } from "@/hooks/use-stable-query";
import { attendanceRate, fillShare, formatShare, type PastEvent } from "./engagement-format";
import { EventAudience } from "./event-audience";
import { EventCell } from "./event-cell";
import { PaceChart } from "./pace-chart";
import { useSemesterSelect } from "./semester-select";

export function PastTable({
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
					<TableHead className={`${LIST_HEAD} w-[90px] pl-4`}>Dato</TableHead>
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
							marker={organizerMarker(event.myRole, true)}
							className="relative"
						>
							<TableCell className={`${LIST_CELL} whitespace-nowrap pl-4 tabular-nums`}>
								{formatOsloDate(event.eventStart, DATE_PATTERNS.shortDate)}
							</TableCell>
							<EventCell event={event} onSelect={onSelect} />
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

function PastEvents({
	events,
	selectedId,
	onSelect,
}: Readonly<{
	events: PastEvent[] | undefined;
	selectedId: Id<"events"> | null;
	onSelect: (eventId: Id<"events">) => void;
}>) {
	if (!events) {
		return (
			<PanelBody>
				<Skeleton className="h-48 w-full" />
			</PanelBody>
		);
	}
	if (!events.length) {
		return (
			<PanelBody>
				<PanelNote>Ingen gjennomførte arrangementer dette semesteret.</PanelNote>
			</PanelBody>
		);
	}
	return <PastTable events={events} selectedId={selectedId} onSelect={onSelect} />;
}

export function PastView({ now }: Readonly<{ now: number }>) {
	const { selected, select } = useSemesterSelect(now);
	const events = useStableQuery(
		api.engagement.queries.past,
		{ now, ...selected },
		`${selected.semester}-${selected.year}`,
	);
	const [picked, setPicked] = useState<Id<"events"> | null>(null);
	const paceRef = useRef<HTMLDivElement>(null);

	const selectedId =
		picked && events?.some((event) => event._id === picked) ? picked : (events?.[0]?._id ?? null);
	const openEvent = (eventId: Id<"events">) => {
		setPicked(eventId);
		paceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="grid gap-4">
			<Panel title="Gjennomførte arrangementer" aside={select}>
				<PastEvents events={events} selectedId={selectedId} onSelect={openEvent} />
			</Panel>
			<div ref={paceRef} className="grid scroll-mt-4 gap-4">
				{selectedId && (
					<>
						<PaceChart eventId={selectedId} now={now} />
						<EventAudience eventId={selectedId} />
					</>
				)}
			</div>
		</div>
	);
}
