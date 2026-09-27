"use client";

import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Badge } from "@workspace/ui/components/badge";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { CompanyLogo } from "@workspace/ui/components/company-logo";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { LIST_CELL, LIST_HEAD } from "@/components/common/table-classes";
import {
	CAMPAIGN_STATUS_BADGES,
	REPORT_DELIVERY_LABELS,
	REPORT_STATUS_LABELS,
} from "@/components/feedback/status-labels";
import { useSelectedEventsStore } from "@/lib/stores/selected-events";
import {
	eventHref,
	type FeedbackStatus,
	groupByMonth,
	type OverviewEvent,
	registrations,
} from "./sections";

const FEEDBACK_BADGE: Record<FeedbackStatus, { variant: "default" | "secondary"; label: string }> =
	{
		draft: { variant: "default", label: REPORT_STATUS_LABELS.draft },
		delivered: { variant: "secondary", label: REPORT_DELIVERY_LABELS.delivered },
		open: CAMPAIGN_STATUS_BADGES.open,
		scheduled: CAMPAIGN_STATUS_BADGES.scheduled,
	};

function Registrations({ event, now }: Readonly<{ event: OverviewEvent; now: number }>) {
	const summary = registrations(event, now);
	if (summary.kind === "note") {
		return <span className="text-muted-foreground">{summary.text}</span>;
	}
	return (
		<div className="whitespace-nowrap tabular-nums">
			{summary.registered} / {summary.limit}
			{summary.waitlist ? (
				<span className="block text-muted-foreground text-xs">
					{summary.waitlist} på venteliste
				</span>
			) : null}
		</div>
	);
}

function SelectEvent({ event }: Readonly<{ event: OverviewEvent }>) {
	const selected = useSelectedEventsStore((state) => state.events.includes(event._id));
	const addEvent = useSelectedEventsStore((state) => state.addEvent);
	const removeEvent = useSelectedEventsStore((state) => state.removeEvent);

	return (
		<Checkbox
			aria-label={event.title}
			checked={selected}
			onCheckedChange={(checked) => (checked ? addEvent(event._id) : removeEvent(event._id))}
			className="relative z-10 align-middle"
		/>
	);
}

function SelectableRow({
	event,
	children,
}: Readonly<{ event: OverviewEvent; children: ReactNode }>) {
	const selected = useSelectedEventsStore((state) => state.events.includes(event._id));
	return (
		<TableRow data-state={selected ? "selected" : undefined} className="relative">
			{children}
		</TableRow>
	);
}

function FeedbackBadge({ status }: Readonly<{ status: FeedbackStatus | null }>) {
	if (!status) return null;
	const { variant, label } = FEEDBACK_BADGE[status];
	return <Badge variant={variant}>{label}</Badge>;
}

export function EventsTable({
	events,
	now,
	withFeedback = false,
	className,
}: Readonly<{ events: OverviewEvent[]; now: number; withFeedback?: boolean; className?: string }>) {
	return (
		<Table className={className}>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={`${LIST_HEAD} w-10 pr-0`} />
					<TableHead className={`${LIST_HEAD} w-[90px]`}>Dato</TableHead>
					<TableHead className={LIST_HEAD}>Arrangement</TableHead>
					<TableHead className={LIST_HEAD}>Hovedansvarlig</TableHead>
					<TableHead className={LIST_HEAD}>Påmeldte</TableHead>
					{withFeedback ? <TableHead className={LIST_HEAD}>Tilbakemelding</TableHead> : null}
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{groupByMonth(events).map((group) => (
					<Fragment key={group.key}>
						<TableRow className="bg-sidebar hover:bg-sidebar">
							<TableCell
								colSpan={withFeedback ? 6 : 5}
								className="px-3 py-1.5 font-semibold text-muted-foreground text-xs first-letter:uppercase"
							>
								{group.label}
							</TableCell>
						</TableRow>
						{group.events.map((event) => (
							<SelectableRow key={event._id} event={event}>
								<TableCell className={`${LIST_CELL} w-10 pr-0`}>
									<SelectEvent event={event} />
								</TableCell>
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
											<Link
												href={eventHref(event)}
												className="block font-medium after:absolute after:inset-0"
											>
												{event.title}
											</Link>
											<span className="block text-muted-foreground text-xs">
												{event.companyName}
											</span>
										</div>
									</div>
								</TableCell>
								<TableCell className={LIST_CELL}>{event.leadName}</TableCell>
								<TableCell className={LIST_CELL}>
									<Registrations event={event} now={now} />
								</TableCell>
								{withFeedback ? (
									<TableCell className={LIST_CELL}>
										<FeedbackBadge status={event.feedbackStatus} />
									</TableCell>
								) : null}
							</SelectableRow>
						))}
					</Fragment>
				))}
			</TableBody>
		</Table>
	);
}
