"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { shortDayTitle } from "../format";

/**
 * «Legg til arrangement»: puts an event from the calendar into the plan, or imports every event in
 * the semester's period at once. Events already in a plan, by hand or through an application, are
 * not offered. Used for the events made before semester planning, and for anything planned
 * outside it.
 */
export function AddPlanEventButton({ semester }: Readonly<{ semester: Doc<"semesters"> }>) {
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const candidates = useQuery(
		api.semesterPlanning.planEvents.queries.candidates,
		open ? { semesterId: semester._id } : "skip",
	);
	const addEvent = useMutation(api.semesterPlanning.planEvents.mutations.addEvent);
	const importFromCalendar = useMutation(
		api.semesterPlanning.planEvents.mutations.importFromCalendar,
	);
	const hasRange = Boolean(semester.firstDate && semester.lastDate);

	const add = async (eventId: Id<"events">, title: string) => {
		setPending(true);
		try {
			await addEvent({ semesterId: semester._id, eventId });
			toast.success(`«${title}» er lagt til i planen.`);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke legge arrangementet til i planen."));
		} finally {
			setPending(false);
		}
	};

	const importAll = async () => {
		setPending(true);
		try {
			const { added } = await importFromCalendar({ semesterId: semester._id });
			toast.success(
				added === 1
					? "Ett arrangement er lagt til i planen."
					: `${added} arrangementer er lagt til i planen.`,
			);
			setOpen(false);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke importere arrangementene."));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button variant="outline" onClick={() => setOpen(true)}>
				<CalendarPlus aria-hidden /> Legg til arrangement
			</Button>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Legg til arrangement i planen</DialogTitle>
					<DialogDescription>
						Arrangementer i semesterets periode som ikke er i en plan ennå. Arrangementet beholdes
						som det er; det vises bare i planen på dagen det starter.
					</DialogDescription>
				</DialogHeader>

				{hasRange ? (
					<Command className="rounded-md border">
						<CommandInput placeholder="Søk etter arrangement eller bedrift" />
						<CommandList className="max-h-72">
							<CommandEmpty>
								{candidates === undefined
									? "Henter arrangementer …"
									: "Ingen arrangementer i perioden som ikke allerede er i planen."}
							</CommandEmpty>
							{(candidates ?? []).map((event) => (
								<CommandItem
									key={event._id}
									value={`${event.title} ${event.companyName} ${event.date}`}
									disabled={pending}
									onSelect={() => void add(event._id, event.title)}
									className="flex items-center justify-between gap-3"
								>
									<span className="min-w-0">
										<span className="block truncate font-medium">{event.title}</span>
										<span className="block truncate text-muted-foreground text-xs">
											{event.companyName}
											{!event.published && " · Ikke publisert"}
										</span>
									</span>
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										{shortDayTitle(event.date)}
									</span>
								</CommandItem>
							))}
						</CommandList>
					</Command>
				) : (
					<p className="rounded-md border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
						Sett første og siste dato under Innstillinger først.
					</p>
				)}

				<DialogFooter className="sm:justify-between">
					{hasRange && candidates && candidates.length > 0 ? (
						<Button variant="outline" disabled={pending} onClick={() => void importAll()}>
							<Download aria-hidden />
							Importer alle {candidates.length}
						</Button>
					) : (
						<span />
					)}
					<Button variant="ghost" onClick={() => setOpen(false)}>
						Lukk
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
