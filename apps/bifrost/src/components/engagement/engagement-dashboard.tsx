"use client";

import { useConvexAuth } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Panel } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useMinute } from "@/hooks/use-minute";
import { AlertsPanel } from "./alerts-panel";
import { defaultSelection } from "./engagement-format";
import { EventAudience } from "./event-audience";
import { PaceChart } from "./pace-chart";
import { PastView } from "./past-view";
import { SemesterView } from "./semester-view";
import { UpcomingTable } from "./upcoming-table";

function LiveView({ now }: Readonly<{ now: number }>) {
	const data = useQuery(api.engagement.queries.upcoming, { now });
	const [picked, setPicked] = useState<Id<"events"> | null>(null);
	const paceRef = useRef<HTMLDivElement>(null);

	if (!data) {
		return (
			<div className="grid gap-4" aria-busy>
				<Skeleton className="h-16 w-full rounded-lg" />
				<Skeleton className="h-96 w-full rounded-lg" />
			</div>
		);
	}

	const selectedId =
		picked && data.events.some((event) => event._id === picked) ? picked : defaultSelection(data);
	const openEvent = (eventId: Id<"events">) => {
		setPicked(eventId);
		paceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="grid gap-4">
			<AlertsPanel alerts={data.alerts} events={data.events} onOpen={openEvent} />
			<Panel title="Kommende arrangementer">
				<UpcomingTable events={data.events} selectedId={selectedId} onSelect={setPicked} />
			</Panel>
			<div ref={paceRef} className="grid scroll-mt-4 gap-4">
				{selectedId && (
					<>
						<PaceChart
							eventId={selectedId}
							now={now}
							note="Viser arrangementet du klikker på i tabellen eller i et varsel. Uten valg åpnes det mest akutte varselet."
						/>
						<EventAudience eventId={selectedId} />
					</>
				)}
			</div>
		</div>
	);
}

function useRegistrationLogBackfill() {
	const { isAuthenticated } = useConvexAuth();
	const pending = useQuery(api.engagement.backfill.pending, isAuthenticated ? {} : "skip");
	const setup = useMutation(api.engagement.backfill.setup);

	useEffect(() => {
		if (pending) void setup({});
	}, [pending, setup]);
}

export function EngagementDashboard() {
	const now = useMinute();
	useRegistrationLogBackfill();

	return (
		<Tabs defaultValue="live" className="w-full">
			<TabsList>
				<TabsTrigger value="live">Nå</TabsTrigger>
				<TabsTrigger value="semester">Semester</TabsTrigger>
				<TabsTrigger value="past">Tidligere</TabsTrigger>
			</TabsList>
			<TabsContent value="live" className="mt-4">
				<LiveView now={now} />
			</TabsContent>
			<TabsContent value="semester" className="mt-4">
				<SemesterView now={now} />
			</TabsContent>
			<TabsContent value="past" className="mt-4">
				<PastView now={now} />
			</TabsContent>
		</Tabs>
	);
}
