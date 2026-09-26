import type { Id } from "@workspace/backend/convex/dataModel";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Badge } from "@workspace/ui/components/badge";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import { ShareBar } from "@workspace/ui/components/products/share-bar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { PRIMARY_SERIES_COLOR } from "@/components/common/chart-colors";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import {
	fillShare,
	formatDelta,
	opensLabel,
	statusBadge,
	type UpcomingEvent,
} from "./engagement-format";

export function StatusBadge({ status }: Readonly<{ status: UpcomingEvent["status"] }>) {
	const { label, variant } = statusBadge(status);
	return <Badge variant={variant}>{label}</Badge>;
}

function Registered({ event }: Readonly<{ event: UpcomingEvent }>) {
	if (event.status.kind === "notOpen") {
		return <span className="text-muted-foreground">{opensLabel(event.status.opensAt)}</span>;
	}
	return (
		<div className="whitespace-nowrap tabular-nums">
			{event.registered} / {event.participationLimit}
			<div className="mt-1.5 w-24">
				<ShareBar
					share={fillShare(event.registered, event.participationLimit)}
					color={PRIMARY_SERIES_COLOR}
				/>
			</div>
			{event.waitlist ? (
				<span className="mt-1 block text-muted-foreground text-xs">
					{event.waitlist} på venteliste
				</span>
			) : null}
		</div>
	);
}

export function UpcomingTable({
	events,
	selectedId,
	onSelect,
}: Readonly<{
	events: UpcomingEvent[];
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
					<TableHead className={`${LIST_HEAD} text-right`}>Siste 24 t</TableHead>
					<TableHead className={LIST_HEAD}>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{events.map((event) => (
					<TableRow
						key={event._id}
						data-state={event._id === selectedId ? "selected" : undefined}
						className="relative"
					>
						<TableCell className={`${LIST_CELL} whitespace-nowrap tabular-nums`}>
							{formatOsloDate(event.eventStart, DATE_PATTERNS.shortDate)}
							<span className="block text-muted-foreground text-xs">
								{formatOsloDate(event.eventStart, DATE_PATTERNS.time)}
							</span>
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
							<Registered event={event} />
						</TableCell>
						<TableCell className={`${LIST_CELL} text-right tabular-nums`}>
							{event.status.kind === "notOpen" ? (
								<span className="text-muted-foreground">0</span>
							) : (
								formatDelta(event.delta24h)
							)}
						</TableCell>
						<TableCell className={LIST_CELL}>
							<StatusBadge status={event.status} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
