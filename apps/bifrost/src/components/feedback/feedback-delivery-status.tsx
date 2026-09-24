"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { formatFeedbackDate } from "@workspace/shared/feedback/time";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";

type DeliveryStatus = NonNullable<
	FunctionReturnType<typeof api.feedback.delivery.status.getEventFeedbackDelivery>
>;

const statusBadges = {
	scheduled: { label: "Planlagt", variant: "secondary" },
	open: { label: "Åpen", variant: "default" },
	closed: { label: "Stengt", variant: "destructive" },
	cancelled: { label: "Avbrutt", variant: "outline" },
} as const;

const alertClassName =
	"rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm";

function scheduleLine({ status, opensAt, closesAt }: DeliveryStatus) {
	const at = (timestamp: number) => formatFeedbackDate(timestamp, "d. MMM 'kl.' HH:mm");
	if (status === "scheduled") return `Sendes ${at(opensAt)}`;
	if (status === "open") return `Stenger ${at(closesAt)}`;
	if (status === "closed") return `Stengt ${at(closesAt)}`;
	return null;
}

function RoundRow({ round, at, sent, delivered, failed }: DeliveryStatus["rounds"][number]) {
	const pending = sent === 0 && at > Date.now();
	return (
		<TableRow className={cn(pending && "text-muted-foreground")}>
			<TableCell>
				{round === 0 ? "Invitasjon" : "Påminnelse"}
				<span className="ml-2 text-muted-foreground">{formatFeedbackDate(at, "d. MMM")}</span>
			</TableCell>
			<TableCell className="text-right">{pending ? null : sent}</TableCell>
			<TableCell className="text-right">{pending ? null : delivered}</TableCell>
			<TableCell className={cn("text-right", failed > 0 && "font-semibold text-destructive")}>
				{pending ? null : failed}
			</TableCell>
		</TableRow>
	);
}

export function FeedbackDeliveryStatus({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const delivery = useQuery(api.feedback.delivery.status.getEventFeedbackDelivery, { eventId });
	if (!delivery) return null;
	const badge = statusBadges[delivery.status];
	const schedule = scheduleLine(delivery);
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle>Utsending</CardTitle>
					<Badge variant={badge.variant}>{badge.label}</Badge>
				</div>
				{schedule && <p className="text-muted-foreground text-sm">{schedule}</p>}
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{delivery.status !== "cancelled" && (
					<Table className="tabular-nums">
						<TableHeader>
							<TableRow>
								<TableHead />
								<TableHead className="text-right">Sendt</TableHead>
								<TableHead className="text-right">Levert</TableHead>
								<TableHead className="text-right">Feilet</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{delivery.rounds.map((round) => (
								<RoundRow key={round.round} {...round} />
							))}
						</TableBody>
					</Table>
				)}
				{delivery.invited > 0 && (
					<div className="flex flex-col gap-1.5 text-sm tabular-nums">
						<div className="flex justify-between">
							<span>Svar</span>
							<span>
								{delivery.responded} av {delivery.invited}
							</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary"
								style={{ width: `${(delivery.responded / delivery.invited) * 100}%` }}
							/>
						</div>
					</div>
				)}
				{delivery.failed > 0 && (
					<p role="alert" className={alertClassName}>
						{delivery.failed} utsendelser feilet.
					</p>
				)}
				{delivery.failure && (
					<div
						role="alert"
						className={cn(alertClassName, "flex flex-wrap items-center justify-between gap-3")}
					>
						<span>{delivery.failure}</span>
						<Button asChild size="sm" variant="outline">
							<Link href="/feedback-forms">Publiser skjemaet</Link>
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
