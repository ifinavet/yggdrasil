"use client";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { type AvailabilityWindow, clock, dateLabel, days, type Interviewer } from "./model";

export function AvailabilityDialog({
	open,
	onOpenChange,
	interviewers,
	onSave,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	interviewers: Interviewer[];
	onSave: (id: string, windows: AvailabilityWindow[]) => void;
}>) {
	const [selected, setSelected] = useState(interviewers[0]?.id ?? "");
	const [drafts, setDrafts] = useState<Record<string, AvailabilityWindow[]>>({});
	const person = interviewers.find((person) => person.id === selected) ?? interviewers[0];
	const windows = person
		? (drafts[person.id] ??
			person.windows ??
			person.available.map((day) => ({ day, start: 540, end: 960 })))
		: [];
	const update = (next: AvailabilityWindow[]) => {
		if (person) setDrafts((current) => ({ ...current, [person.id]: next }));
	};
	const invalid = windows.some((window) => window.start >= window.end);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle>Tilgjengelighet</DialogTitle>
				</DialogHeader>
				{person ? (
					<>
						<Select value={person.id} onValueChange={setSelected}>
							<SelectTrigger className="w-full" aria-label="Styremedlem">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{interviewers.map((member) => (
									<SelectItem key={member.id} value={member.id}>
										{member.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className="flex flex-col gap-5">
							{days.map((day) => (
								<section key={day} className="flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<h3 className="font-medium">{dateLabel(day)}</h3>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => update([...windows, { day, start: 540, end: 960 }])}
										>
											<Plus />
											Legg til tidsrom
										</Button>
									</div>
									{windows.map(
										(window, index) =>
											window.day === day && (
												<div key={`${day}-${index}`} className="flex flex-wrap items-center gap-2">
													<Input
														type="time"
														aria-label={`Fra ${dateLabel(day)}, tidsrom ${index + 1}`}
														className="w-32"
														value={clock(window.start)}
														onChange={(event) => {
															if (!event.target.value) return;
															const [hours = 0, minutes = 0] = event.target.value
																.split(":")
																.map(Number);
															update(
																windows.map((entry, i) =>
																	i === index ? { ...entry, start: hours * 60 + minutes } : entry,
																),
															);
														}}
													/>
													<Input
														type="time"
														aria-label={`Til ${dateLabel(day)}, tidsrom ${index + 1}`}
														className="w-32"
														value={clock(window.end)}
														onChange={(event) => {
															if (!event.target.value) return;
															const [hours = 0, minutes = 0] = event.target.value
																.split(":")
																.map(Number);
															update(
																windows.map((entry, i) =>
																	i === index ? { ...entry, end: hours * 60 + minutes } : entry,
																),
															);
														}}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														aria-label={`Fjern tidsrom ${index + 1} ${dateLabel(day)}`}
														onClick={() => update(windows.filter((_, i) => i !== index))}
													>
														<Trash2 />
													</Button>
												</div>
											),
									)}
								</section>
							))}
						</div>
						{invalid && (
							<p role="alert" className="text-destructive text-sm">
								Sluttid må være etter starttid.
							</p>
						)}
						<Button
							disabled={
								invalid ||
								Object.values(drafts).some((entries) =>
									entries.some((entry) => entry.start >= entry.end),
								)
							}
							onClick={() => {
								for (const [id, entries] of Object.entries(drafts)) onSave(id, entries);
								setDrafts({});
								onOpenChange(false);
							}}
						>
							Lagre tilgjengelighet
						</Button>
					</>
				) : (
					<p>Velg intervjuere i innstillingene først.</p>
				)}
			</DialogContent>
		</Dialog>
	);
}
