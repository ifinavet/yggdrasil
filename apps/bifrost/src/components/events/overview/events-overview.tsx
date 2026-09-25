"use client";

import type { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { Fold } from "@workspace/ui/components/fold";
import { SearchField } from "@workspace/ui/components/search-field";
import type { Preloaded } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
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

	const { mine, upcoming, past, unpublished } = useMemo(
		() => splitIntoSections(events, now, search),
		[events, now, search],
	);

	return (
		<div>
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="font-semibold text-2xl tracking-[-0.015em]">Arrangementer</h2>
				<span className="flex-1" />
				<SearchField
					value={search}
					onChange={setSearch}
					placeholder="Arrangement eller bedrift"
					className="sm:w-80"
				/>
				<SelectSemester preloadedPossibleSemesters={preloadedPossibleSemesters} />
				<SelectedEvents />
				<Button asChild>
					<Link href="/events/new-event">
						<Plus className="size-4" /> Lag et nytt arrangement
					</Link>
				</Button>
			</div>

			{mine.length > 0 ? (
				<>
					<SectionTitle>Dine arrangementer</SectionTitle>
					<div className="grid gap-6 sm:grid-cols-[repeat(auto-fill,22rem)]">
						{mine.map((event) => (
							<MyEventCard key={event._id} event={event} />
						))}
					</div>
				</>
			) : null}

			{upcoming.length > 0 ? (
				<>
					<SectionTitle>Kommende</SectionTitle>
					<div className="overflow-hidden rounded-lg border bg-card">
						<EventsTable events={upcoming} now={now} />
					</div>
				</>
			) : null}

			{past.length > 0 ? (
				<Fold className="mt-3" title="Gjennomført">
					<EventsTable events={past} now={now} withFeedback />
				</Fold>
			) : null}

			{unpublished.length > 0 ? (
				<Fold className="mt-3" title="Upubliserte">
					<EventsTable events={unpublished} now={now} />
				</Fold>
			) : null}
		</div>
	);
}
