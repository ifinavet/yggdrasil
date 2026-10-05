"use client";
import { api } from "@workspace/backend/convex/api";
import type { Doc, Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Callout } from "@workspace/ui/components/products/callout";
import { SearchSelect, type SearchSelectItem } from "@workspace/ui/components/search-select";
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
	const sources = useAction(api.admissions.interviews.calendar.sources);
	const save = useMutation(api.admissions.board.updateSettings);
	const [calendars, setCalendars] = useState<
		Record<string, { items: SearchSelectItem[]; selectedIds: string[] }>
	>({});
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState("");
	async function refresh(id: Id<"users">) {
		setPending(id);
		setError("");
		try {
			const result = await sources({ periodId: period._id, interviewerId: id });
			setCalendars((value) => ({
				...value,
				[id]: {
					items: result.map((calendar) => ({
						id: calendar.id,
						label: calendar.name,
						disabledReason: calendar.readable ? undefined : "Mangler tilgang",
					})),
					selectedIds: result
						.filter((calendar) => calendar.selected && calendar.readable)
						.map((calendar) => calendar.id),
				},
			}));
		} catch (cause) {
			setError(convexErrorMessage(cause, "Kunne ikke hente kalenderne."));
		} finally {
			setPending(null);
		}
	}
	async function persist() {
		setPending("save");
		setError("");
		try {
			await save({
				periodId: period._id,
				expectedRevision: period.revision,
				settings: {},
				interviewers: period.interviewers.map((person) => ({
					...person,
					selectedCalendarIds: calendars[person.userId]?.selectedIds ?? person.selectedCalendarIds,
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
				{people.map((person) => {
					const selection = calendars[person.id];
					return (
						<section key={person.id} className="grid gap-3">
							<div className="flex items-center gap-3">
								<Avatar>
									<AvatarImage src={person.image} alt="" />
									<AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
								</Avatar>
								<h3 id={`calendar-person-${person.id}`} className="flex-1 font-medium">
									{person.name}
								</h3>
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
							{selection && (
								<SearchSelect
									multiple
									aria-labelledby={`calendar-person-${person.id}`}
									items={selection.items}
									value={selection.selectedIds}
									onChange={(selectedIds) =>
										setCalendars((current) => ({
											...current,
											[person.id]: { ...selection, selectedIds },
										}))
									}
									disabled={pending !== null}
									placeholder="Velg kalendere"
									searchPlaceholder="Søk etter kalender"
								/>
							)}
						</section>
					);
				})}
				<Button disabled={pending !== null} onClick={() => void persist()}>
					Lagre kalendere
				</Button>
			</DialogContent>
		</Dialog>
	);
}
