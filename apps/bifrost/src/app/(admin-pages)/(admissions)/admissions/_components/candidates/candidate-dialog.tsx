"use client";
import { formatOsloDate } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	type Candidate,
	clock,
	type Decision,
	dateLabel,
	decisionLabels,
	decisionLocked,
	decisions,
	type Interview,
	type Interviewer,
	roomUrl,
	type Settings,
} from "../model";

export function CandidateDialog({
	candidate,
	interview,
	settings,
	room,
	onClose,
	onDecisionChange,
	onRoomChange,
	team,
	onSaveNotes,
	actions,
}: Readonly<{
	candidate: Candidate | undefined;
	interview: Interview | undefined;
	settings: Settings;
	room: string;
	onClose: () => void;
	onDecisionChange: (decision: Decision) => void;
	onRoomChange: (room: string) => void;
	team: Interviewer[];
	onSaveNotes: (notes: string) => Promise<void>;
	actions?: ReactNode;
}>) {
	const [noteDraft, setNoteDraft] = useState(candidate?.notes ?? "");
	return (
		<Dialog
			open={Boolean(candidate)}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				className="admissions-candidate-dialog max-h-[90dvh] overflow-y-auto p-6 sm:max-w-5xl sm:p-8"
				aria-describedby={undefined}
			>
				{candidate && (
					<>
						<DialogHeader>
							<DialogTitle className="text-left text-2xl">{candidate.name}</DialogTitle>
						</DialogHeader>
						<div className="admissions-profile-meta mb-4 flex flex-wrap gap-x-6 gap-y-2 text-base">
							<span>{candidate.program}</span>
							<span>{candidate.year}. år</span>
							<span>{candidate.group}</span>
						</div>
						<div className="admissions-profile admissions-profile-layout [&_p]:wrap-anywhere grid grid-cols-1 gap-8 text-base leading-relaxed md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a]:underline [&_h3]:mb-3 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2 [&_h3]:font-semibold [&_label]:flex [&_label]:flex-col [&_label]:items-start [&_label]:gap-3 [&_p]:max-w-prose [&_p]:whitespace-pre-wrap">
							<div className="admissions-profile-main flex min-w-0 flex-col gap-8">
								<section>
									<h3>Fortell litt om deg selv</h3>
									<p>{candidate.about}</p>
								</section>
								<section>
									<h3>Hvorfor vil du bli med i Navet?</h3>
									<p>{candidate.motivation}</p>
								</section>

								<Label htmlFor="interview-notes">
									Intervjunotater
									<Textarea
										id="interview-notes"
										className="font-normal text-base leading-relaxed"
										rows={4}
										value={noteDraft}
										onChange={(e) => setNoteDraft(e.target.value)}
										placeholder="Notater fra samtalen"
									/>
								</Label>
								<Button onClick={() => void onSaveNotes(noteDraft)}>Lagre notater</Button>
								<div className="admissions-decision flex flex-col gap-3">
									<Label htmlFor="candidate-decision">Vedtak</Label>
									<Select
										value={candidate.decision}
										disabled={decisionLocked(candidate)}
										onValueChange={(value) => onDecisionChange(value as Decision)}
									>
										<SelectTrigger id="candidate-decision" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{decisions.map((d) => (
												<SelectItem key={d} value={d}>
													{decisionLabels[d]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<aside className="admissions-profile-interview min-w-0 self-start rounded-xl bg-muted p-5 [&_section]:mb-4 [&_section]:flex [&_section]:flex-col [&_section]:gap-4">
								<section>
									<h3>
										<CalendarDays size={16} />
										Intervju
									</h3>
									{interview ? (
										<>
											<p>
												{formatOsloDate(interview.startAt, "EEE d. MMM HH:mm")}–
												{formatOsloDate(interview.endAt, "HH:mm")}
											</p>
											<Label htmlFor="candidate-room">
												Rom
												<Input
													id="candidate-room"
													value={room}
													onChange={(event) => onRoomChange(event.target.value)}
													onBlur={(event) => {
														if (!event.target.value.trim()) onRoomChange(settings.room);
													}}
												/>
											</Label>
											<a href={roomUrl(room || interview.room)} target="_blank" rel="noreferrer">
												<MapPin size={15} />
												{room || interview.room}
												<ExternalLink size={13} />
											</a>
											<p>
												{interview.interviewerIds
													.map((id) => team.find((p) => p.id === id)?.name)
													.join(" og ")}
											</p>
										</>
									) : (
										<div>
											<p>
												{candidate.availability.length
													? "Ingen felles tid med to intervjuere."
													: "Kandidaten har ikke oppgitt tilgjengelighet."}
											</p>
										</div>
									)}
									<details className="admissions-availability-details [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:font-medium">
										<summary>Tilgjengelige tider</summary>
										<div className="flex flex-col gap-2">
											{candidate.availability.map((window) => (
												<p key={`${window.day}-${window.start}-${window.end}`}>
													{dateLabel(window.day)} {clock(window.start)}–{clock(window.end)}
												</p>
											))}
										</div>
									</details>
								</section>
								{actions}
							</aside>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
