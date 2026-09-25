"use client";

import type { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import type { Preloaded } from "convex/react";
import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import SelectSemester from "../select-semester";
import SelectedEvents from "../selected-events";
import { EventsTable } from "./events-table";
import { MyEventCard } from "./my-event-card";
import { currentPlatform, searchShortcutKeys } from "./search-shortcut";
import { type OverviewEvent, splitIntoSections } from "./sections";

function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
	return <h3 className="mt-7 mb-3 font-semibold text-base">{children}</h3>;
}

function Fold({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
	return (
		<details className="group mt-3 rounded-lg border bg-card">
			<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
				<ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-90" />
				{title}
			</summary>
			<div className="border-t">{children}</div>
		</details>
	);
}

function SearchField({
	value,
	onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [shortcutKeys, setShortcutKeys] = useState(() => searchShortcutKeys("mac"));

	useEffect(() => {
		setShortcutKeys(searchShortcutKeys(currentPlatform()));
	}, []);

	useEffect(() => {
		function toggleOnShortcut(event: KeyboardEvent) {
			const input = inputRef.current;
			if (!input || !((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) return;
			event.preventDefault();
			if (document.activeElement === input) input.blur();
			else input.focus();
		}
		window.addEventListener("keydown", toggleOnShortcut);
		return () => window.removeEventListener("keydown", toggleOnShortcut);
	}, []);

	return (
		<label className="flex h-9 w-full items-center gap-2 rounded-md border border-input px-3 text-muted-foreground shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 sm:w-80 dark:bg-input/30">
			<Search className="size-4 flex-none" />
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") event.currentTarget.blur();
				}}
				placeholder="Arrangement eller bedrift"
				className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
			/>
			<span className="ml-auto inline-flex gap-0.5">
				{shortcutKeys.map((key) => (
					<kbd
						key={key}
						className="rounded-[4px] border bg-muted px-[5px] font-medium font-sans text-[11px] text-muted-foreground leading-[18px]"
					>
						{key}
					</kbd>
				))}
			</span>
		</label>
	);
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
				<SearchField value={search} onChange={setSearch} />
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
				<Fold title="Gjennomført">
					<EventsTable events={past} now={now} withFeedback />
				</Fold>
			) : null}

			{unpublished.length > 0 ? (
				<Fold title="Upubliserte">
					<EventsTable events={unpublished} now={now} />
				</Fold>
			) : null}
		</div>
	);
}
