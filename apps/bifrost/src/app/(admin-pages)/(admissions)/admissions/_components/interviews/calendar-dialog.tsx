"use client";
import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Callout } from "@workspace/ui/components/products/callout";
import { useAction, useMutation } from "convex/react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function CalendarDialog({
	period,
	people,
	onClose,
}: Readonly<{
	period: Doc<"admissionPeriods">;
	people: { id: Id<"users">; name: string; image: string }[];
	onClose: () => void;
}>) {
	const sources = useAction(api.admissions.calendar.sources);
	const save = useMutation(api.admissions.board.updateInterviewers);
	const [calendars, setCalendars] = useState<
		Record<string, { id: string; name: string; selected: boolean; readable: boolean }[]>
	>({});
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState("");
	async function refresh(id: Id<"users">) {
		setPending(id);
		setError("");
		try {
			const result = await sources({ periodId: period._id, interviewerId: id });
			setCalendars((value) => ({ ...value, [id]: result }));
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke hente kalenderne."));
		} finally {
			setPending(null);
		}
	}
	function toggleCalendar(personId: string, calendarId: string, selected: boolean) {
		setCalendars((value) => ({
			...value,
			[personId]: (value[personId] ?? []).map((entry) =>
				entry.id === calendarId ? { ...entry, selected } : entry,
			),
		}));
	}
	async function persist() {
		setPending("save");
		setError("");
		try {
			await save({
				periodId: period._id,
				expectedRevision: period.revision,
				interviewers: period.interviewers.map((person) => ({
					...person,
					selectedCalendarIds:
						calendars[person.userId]
							?.filter((entry) => entry.selected && entry.readable)
							.map((entry) => entry.id) ?? person.selectedCalendarIds,
				})),
			});
			onClose();
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke lagre kalendervalget."));
		} finally {
			setPending(null);
		}
	}
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				aria-describedby={undefined}
				className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
			>
				<DialogHeader>
					<DialogTitle>Kalendere</DialogTitle>
				</DialogHeader>
				<Callout>
					Legg til private kalendere og timeplanen i Google Kalender på ifinavet.no-kontoen. Velg
					kalenderne her, så tar vi hensyn til avtalene når vi finner intervjutider.
				</Callout>
				<a
					href="https://calendar.google.com/"
					target="_blank"
					rel="noreferrer"
					className="underline"
				>
					Åpne Google Kalender
				</a>
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
				{people.map((person) => (
					<section key={person.id} className="grid gap-3">
						<div className="flex items-center gap-3">
							<Avatar>
								<AvatarImage src={person.image} alt="" />
								<AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
							</Avatar>
							<h3 className="flex-1 font-medium">{person.name}</h3>
							<Button
								variant="outline"
								disabled={pending !== null}
								onClick={() => void refresh(person.id)}
								aria-label={`Hent kalendere for ${person.name}`}
							>
								<RefreshCw />
								Hent kalendere
							</Button>
						</div>
						{calendars[person.id]?.map((calendar) => (
							<label
								htmlFor={`calendar-${person.id}-${calendar.id}`}
								key={calendar.id}
								className="flex items-center gap-3 pl-11"
							>
								<Checkbox
									id={`calendar-${person.id}-${calendar.id}`}
									disabled={!calendar.readable || pending !== null}
									checked={calendar.selected}
									onCheckedChange={(checked) =>
										toggleCalendar(person.id, calendar.id, checked === true)
									}
								/>
								{calendar.name}
								{!calendar.readable && <span className="text-destructive">Mangler tilgang</span>}
							</label>
						))}
					</section>
				))}
				<Button disabled={pending !== null} onClick={() => void persist()}>
					Lagre kalendere
				</Button>
			</DialogContent>
		</Dialog>
	);
}
