"use client";

import type { api } from "@workspace/backend/convex/api";
import type { EventsListGuideStep } from "@workspace/shared/events/guide";
import { Button } from "@workspace/ui/components/button";
import { Fold } from "@workspace/ui/components/fold";
import { SearchField } from "@workspace/ui/components/search-field";
import type { Preloaded } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { searchFolds } from "@/lib/search";
import { useFoodBackfill } from "../food/use-food-backfill";
import { EventsListGuideHint, EventsListGuideProvider, EventsListGuideReplay } from "../guide";
import SelectSemester from "../select-semester";
import SelectedEvents from "../selected-events";
import { EventsTable } from "./events-table";
import { MyEventCard } from "./my-event-card";
import { type OverviewEvent, splitIntoSections } from "./sections";

function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
	return <h3 className="mt-7 mb-3 font-semibold text-base">{children}</h3>;
}

export function EventsOverview({
	events,
	now,
	preloadedPossibleSemesters,
}: Readonly<{
	events: OverviewEvent[];
	now: number;
	preloadedPossibleSemesters: Preloaded<typeof api.events.queries.getPossibleSemesters>;
}>) {
	const [search, setSearch] = useState("");
	useFoodBackfill();

	const { mine, upcoming, past, unpublished } = useMemo(
		() => splitIntoSections(events, now, search),
		[events, now, search],
	);
	const folds = searchFolds(search);
	const available = useMemo(() => {
		const steps = new Set<EventsListGuideStep>(["search", "semester", "create"]);
		if (mine.length > 0) steps.add("mine");
		if (past.length > 0) steps.add("past");
		return steps;
	}, [mine.length, past.length]);

	return (
		<EventsListGuideProvider available={available}>
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="font-semibold text-2xl tracking-[-0.015em]">Arrangementer</h2>
				<EventsListGuideReplay />
				<span className="flex-1" />
				<EventsListGuideHint step="search">
					<div className="w-full sm:w-96">
						<SearchField
							value={search}
							onChange={setSearch}
							placeholder="Arrangement, bedrift eller person"
						/>
					</div>
				</EventsListGuideHint>
				<EventsListGuideHint step="semester">
					<div>
						<SelectSemester preloadedPossibleSemesters={preloadedPossibleSemesters} />
					</div>
				</EventsListGuideHint>
				<SelectedEvents />
				<EventsListGuideHint step="create">
					<Button asChild>
						<Link href="/events/new-event">
							<Plus className="size-4" /> Lag et nytt arrangement
						</Link>
					</Button>
				</EventsListGuideHint>
			</div>

			{mine.length > 0 ? (
				<>
					<EventsListGuideHint step="mine">
						<div className="w-fit">
							<SectionTitle>Dine bedriftspresentasjoner</SectionTitle>
						</div>
					</EventsListGuideHint>
					<div className="grid gap-6 sm:grid-cols-[repeat(auto-fill,22rem)]">
						{mine.map((event) => (
							<MyEventCard key={event._id} event={event} />
						))}
					</div>
				</>
			) : null}

			{upcoming.length > 0 ? (
				<>
					<SectionTitle>Andre bedriftspresentasjoner</SectionTitle>
					<div className="overflow-hidden rounded-lg border bg-card">
						<EventsTable events={upcoming} now={now} />
					</div>
				</>
			) : null}

			{past.length > 0 ? (
				<Fold
					key={`past-${folds.key}`}
					className="mt-3"
					title={
						<EventsListGuideHint step="past">
							<span>Gjennomført</span>
						</EventsListGuideHint>
					}
					open={folds.open}
				>
					<EventsTable events={past} now={now} withFeedback />
				</Fold>
			) : null}

			{unpublished.length > 0 ? (
				<Fold
					key={`unpublished-${folds.key}`}
					className="mt-3"
					title="Upubliserte"
					open={folds.open}
				>
					<EventsTable events={unpublished} now={now} />
				</Fold>
			) : null}
		</EventsListGuideProvider>
	);
}
