"use client";

import { useConvexAuth } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import type { EngagementGuideStep } from "@workspace/shared/engagement/guide";
import { Callout } from "@workspace/ui/components/products/callout";
import { Panel } from "@workspace/ui/components/products/panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useMinute } from "@/hooks/use-minute";
import { useStableQuery } from "@/hooks/use-stable-query";
import { AlertsPanel } from "./alerts-panel";
import { CompaniesView } from "./companies-view";
import { EngagementBreadcrumb } from "./engagement-breadcrumb";
import { defaultSelection, type UpcomingData } from "./engagement-format";
import { EventAudience } from "./event-audience";
import { FoodsView } from "./foods-view";
import { GuideHint, GuideProvider, GuideReplay } from "./guide";
import { liveGuideSteps } from "./guide-steps";
import { PaceChart } from "./pace-chart";
import { PastView } from "./past-view";
import { SemesterView } from "./semester-view";
import { UpcomingTable } from "./upcoming-table";

function useLiveEvents(now: number) {
	const data = useStableQuery(api.engagement.queries.upcoming, { now });
	const [picked, setPicked] = useState<Id<"events"> | null>(null);
	const pickedStillListed = data?.events.some((event) => event._id === picked);
	let selectedId: Id<"events"> | null = null;
	if (data) selectedId = pickedStillListed ? picked : defaultSelection(data);
	return { data, selectedId, select: setPicked };
}

function LiveView({
	now,
	data,
	selectedId,
	onSelect,
}: Readonly<{
	now: number;
	data: UpcomingData | undefined;
	selectedId: Id<"events"> | null;
	onSelect: (eventId: Id<"events">) => void;
}>) {
	const paceRef = useRef<HTMLDivElement>(null);

	if (!data) {
		return (
			<div className="grid gap-4" aria-busy>
				<Skeleton className="h-16 w-full rounded-lg" />
				<Skeleton className="h-96 w-full rounded-lg" />
			</div>
		);
	}

	const openEvent = (eventId: Id<"events">) => {
		onSelect(eventId);
		paceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="grid gap-4">
			{data.alerts.length > 0 && (
				<GuideHint step="alerts">
					<div className="min-w-0">
						<AlertsPanel alerts={data.alerts} events={data.events} onOpen={openEvent} />
					</div>
				</GuideHint>
			)}
			<GuideHint step="select">
				<div className="min-w-0">
					<Panel title="Kommende arrangementer">
						<UpcomingTable events={data.events} selectedId={selectedId} onSelect={onSelect} />
					</Panel>
				</div>
			</GuideHint>
			<div ref={paceRef} className="grid scroll-mt-4 gap-4">
				{selectedId && (
					<>
						<GuideHint step="prognosis">
							<div className="min-w-0">
								<PaceChart eventId={selectedId} now={now} />
							</div>
						</GuideHint>
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
	const outcome = useQuery(api.engagement.backfill.importOutcome, isAuthenticated ? {} : "skip");
	const setup = useMutation(api.engagement.backfill.setup);

	useEffect(() => {
		if (pending) void setup({});
	}, [pending, setup]);

	useEffect(() => {
		if (outcome?.state === "failed") console.error("Unregistration import failed", outcome);
	}, [outcome]);
}

const NO_STEPS: ReadonlySet<EngagementGuideStep> = new Set();

function LiveTab({
	now,
	onSteps,
}: Readonly<{ now: number; onSteps: (steps: ReadonlySet<EngagementGuideStep>) => void }>) {
	const live = useLiveEvents(now);
	const curve = useQuery(
		api.engagement.queries.paceCurve,
		live.selectedId ? { eventId: live.selectedId, now } : "skip",
	);
	const stepKey = [
		...liveGuideSteps({
			live: true,
			eventCount: live.data?.events.length,
			alertCount: live.data?.alerts.length ?? 0,
			selected: live.selectedId !== null,
			curve,
		}),
	]
		.sort((a, b) => a.localeCompare(b))
		.join(",");

	useEffect(() => {
		onSteps(stepKey ? new Set(stepKey.split(",") as EngagementGuideStep[]) : NO_STEPS);
		return () => onSteps(NO_STEPS);
	}, [stepKey, onSteps]);

	return (
		<LiveView now={now} data={live.data} selectedId={live.selectedId} onSelect={live.select} />
	);
}

export function EngagementDashboard() {
	const now = useMinute();
	useRegistrationLogBackfill();
	const [tab, setTab] = useState("live");
	const [liveSteps, setLiveSteps] = useState(NO_STEPS);
	const steps = tab === "live" ? liveSteps : NO_STEPS;

	return (
		<GuideProvider available={steps}>
			<div className="mb-4 flex items-center justify-between gap-2">
				<EngagementBreadcrumb />
				<GuideReplay />
			</div>
			<Callout className="mb-4">
				Siden er under utvikling, og vi jobber fortsatt med datagrunnlaget. Tallene er stort sett
				nøyaktige, men kan avvike med noen få prosent enkelte steder.
			</Callout>
			<Tabs value={tab} onValueChange={setTab} className="w-full">
				<TabsList>
					<TabsTrigger value="live">Nå</TabsTrigger>
					<TabsTrigger value="semester">Semester</TabsTrigger>
					<GuideHint step="past">
						<TabsTrigger value="past">Tidligere</TabsTrigger>
					</GuideHint>
					<TabsTrigger value="companies">Per bedrift</TabsTrigger>
					<TabsTrigger value="foods">Per mat</TabsTrigger>
				</TabsList>
				<TabsContent value="live" className="mt-4">
					<LiveTab now={now} onSteps={setLiveSteps} />
				</TabsContent>
				<TabsContent value="semester" className="mt-4">
					<SemesterView now={now} />
				</TabsContent>
				<TabsContent value="past" className="mt-4">
					<PastView now={now} />
				</TabsContent>
				<TabsContent value="companies" className="mt-4">
					<CompaniesView now={now} />
				</TabsContent>
				<TabsContent value="foods" className="mt-4">
					<FoodsView now={now} />
				</TabsContent>
			</Tabs>
		</GuideProvider>
	);
}
