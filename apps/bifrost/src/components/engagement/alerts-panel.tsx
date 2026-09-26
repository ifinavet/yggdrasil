"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Panel } from "@workspace/ui/components/products/panel";
import { Sparkline } from "@workspace/ui/components/products/sparkline";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
	alertActivity,
	type EngagementAlert,
	statusBadge,
	type UpcomingEvent,
} from "./engagement-format";
import { UnregisterLogDialog } from "./unregister-log-dialog";

type LogTarget = { eventId: Id<"events">; title: string };

export function AlertsPanel({
	alerts,
	events,
	onOpen,
}: Readonly<{
	alerts: readonly EngagementAlert[];
	events: readonly UpcomingEvent[];
	onOpen: (eventId: Id<"events">) => void;
}>) {
	const dismissAlert = useMutation(api.engagement.alerts.dismissAlert);
	const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
	const eventsById = new Map(events.map((event) => [event._id, event]));

	if (alerts.length === 0) return null;

	return (
		<Panel title="Pågående varsler">
			<ul className="divide-y">
				{alerts.map((alert) => {
					const event = eventsById.get(alert.eventId);
					const badge = event ? statusBadge(event.status) : null;
					const activity = alertActivity(alert);
					return (
						<li
							key={alert._id}
							className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_15rem] sm:items-center sm:gap-6"
						>
							<div className="grid min-w-0 gap-1">
								<div className="flex flex-wrap items-center gap-2">
									{badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
									<span className="text-[13px] text-muted-foreground tabular-nums">
										Siden {formatOsloDate(alert.triggeredAt, DATE_PATTERNS.time)}
									</span>
								</div>
								<p className="font-medium">{alert.summary}</p>
								<p className="text-[13px] text-muted-foreground">{alert.detail}</p>
							</div>
							<figure className="grid gap-1">
								<Sparkline values={activity.values} max={activity.max} />
								<figcaption className="text-[11px] text-muted-foreground">
									{activity.caption}
								</figcaption>
							</figure>
							<div className="flex flex-wrap gap-2 sm:justify-end">
								<Button variant="outline" size="sm" onClick={() => onOpen(alert.eventId)}>
									Åpne
								</Button>
								{alert.rule === "unregisterWave" && (
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setLogTarget({
												eventId: alert.eventId,
												title: event?.title ?? alert.summary,
											})
										}
									>
										Se logg
									</Button>
								)}
								<Button
									variant="ghost"
									size="sm"
									onClick={() => void dismissAlert({ alertId: alert._id })}
								>
									Skjul
								</Button>
							</div>
						</li>
					);
				})}
			</ul>
			{logTarget && (
				<UnregisterLogDialog
					eventId={logTarget.eventId}
					title={logTarget.title}
					open
					onOpenChange={(open) => {
						if (!open) setLogTarget(null);
					}}
				/>
			)}
		</Panel>
	);
}
